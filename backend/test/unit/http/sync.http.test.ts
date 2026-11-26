import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CSRF, type TestApp, createTestApp } from '../../support/http-app';

let t: TestApp;
let alice: string;
let bob: string;

// A new application, storage and people for EVERY test: no test depends on what another one pushed.
beforeEach(async () => {
  t = await createTestApp();
  alice = await t.login();
  t.provider.identity = { ...t.provider.identity, subject: 'sub-bob', email: 'bob@example.test', displayName: 'Bob' };
  bob = await t.login();
});
afterEach(async () => {
  await t.close();
});

const push = (cookie: string, body: unknown, headers: Record<string, string> = {}) =>
  t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF, ...headers }, payload: body as object });
const changes = (cookie: string, query = '') => t.app.inject({ method: 'GET', url: `/api/v1/sync/changes${query}`, headers: { cookie } });
const mut = (over: Record<string, unknown> = {}) => ({ mutationId: randomUUID(), resource: 'account', op: 'put', id: randomUUID(), data: { body: { name: 'Nubank' } }, ...over });

describe('protections', () => {
  it('needs a login', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/sync/changes' })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: CSRF, payload: { mutations: [mut()] } })).statusCode).toBe(401);
  });

  it('push is refused without the CSRF protections, even with a good cookie', async () => {
    const body = { mutations: [mut()] };
    expect((await t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie: alice }, payload: body })).statusCode).toBe(403);
    expect((await push(alice, body, { origin: 'http://evil.example' })).statusCode).toBe(403);
    expect((await changes(alice)).json().changes).toEqual([]);
  });

  it('answers are never cached', async () => {
    expect((await changes(alice)).headers['cache-control']).toBe('no-store');
  });
});

describe('POST /api/v1/sync/push', () => {
  it('applies and answers each mutation', async () => {
    const m = mut();
    const res = await push(alice, { mutations: [m] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [{ mutationId: m.mutationId, status: 'applied', version: expect.any(Number) }] });
  });

  it('sending the same thing again gives the same answer and no duplicate', async () => {
    const m = mut();
    const first = await push(alice, { mutations: [m] });
    const second = await push(alice, { mutations: [m] });
    expect(second.json()).toEqual(first.json());
    const feed = (await changes(alice)).json().changes.filter((c: { id: string }) => c.id === m.id);
    expect(feed).toHaveLength(1);
  });

  it('per-record problems are answered per record, with the same 200', async () => {
    const res = await push(alice, { mutations: [mut(), mut({ data: { body: { name: '' } } }), mut()] });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.map((r: { status: string }) => r.status)).toEqual(['applied', 'rejected', 'skipped']);
    expect(res.json().results[1].reason).toBe('invalid_data');
  });

  it.each([
    ['no body', undefined],
    ['no mutations', { mutations: [] }],
    ['mutations is not a list', { mutations: 'x' }],
    ['an extra field', { mutations: [mut()], admin: true }],
    ['an extra field in a mutation', { mutations: [mut({ userId: 'someone' })] }],
    ['a mutation id that is not a uuid', { mutations: [mut({ mutationId: 'nope' })] }],
    ['a record id that is not a uuid', { mutations: [mut({ id: "1' OR '1'='1" })] }],
    ['an unknown operation', { mutations: [mut({ op: 'patch' })] }],
    ['a missing resource', { mutations: [mut({ resource: undefined })] }],
    ['a resource name that is huge', { mutations: [mut({ resource: 'a'.repeat(41) })] }],
    ['101 mutations', { mutations: Array.from({ length: 101 }, () => mut()) }],
  ])('refuses %s with 400 and applies nothing', async (_label, body) => {
    const before = (await changes(alice)).json().changes.length;
    const res = await push(alice, body);
    expect(res.statusCode).toBe(400);
    expect((await changes(alice)).json().changes.length).toBe(before);
  });

  it('accepts exactly 100 mutations', async () => {
    const res = await push(alice, { mutations: Array.from({ length: 100 }, () => mut()) });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toHaveLength(100);
  });

  it('a body over the size limit is 413', async () => {
    const res = await push(alice, { mutations: [mut({ data: { name: 'a'.repeat(2 * 1024 * 1024) } })] });
    expect(res.statusCode).toBe(413);
  });
});

describe('GET /api/v1/sync/changes', () => {
  it.each(['cursor=-1', 'cursor=abc', 'cursor=1.5', 'cursor=1e3', 'cursor=9999999999999999', 'limit=0', 'limit=1001', 'limit=abc', 'extra=1'])(
    'refuses %s with 400',
    async (query) => {
      expect((await changes(alice, `?${query}`)).statusCode).toBe(400);
    },
  );

  it('pages with cursor and limit until nothing is left', async () => {
    const fresh = await createTestApp();
    try {
      const cookie = await fresh.login();
      const send = (body: unknown) => fresh.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF }, payload: body as object });
      await send({ mutations: Array.from({ length: 5 }, () => mut()) });
      const seen: string[] = [];
      let cursor = '0';
      for (let guard = 0; guard < 10; guard++) {
        const page = (await fresh.app.inject({ method: 'GET', url: `/api/v1/sync/changes?cursor=${cursor}&limit=2`, headers: { cookie } })).json();
        seen.push(...page.changes.map((c: { id: string }) => c.id));
        cursor = page.cursor;
        if (!page.hasMore) break;
      }
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
      expect(cursor).toBe('5');
    } finally {
      await fresh.close();
    }
  });
});

describe('person B against person A through the sync', () => {
  it('B never sees A\'s changes, cannot overwrite A\'s record, and cannot delete it', async () => {
    const id = randomUUID();
    await push(alice, { mutations: [mut({ id, data: { body: { name: 'Alice private' } } })] });

    expect(JSON.stringify((await changes(bob)).json())).not.toContain('Alice private');
    const hijack = await push(bob, { mutations: [mut({ id, data: { body: { name: 'hacked' } } })] });
    expect(hijack.json().results[0]).toMatchObject({ status: 'rejected', reason: 'not_found' });
    await push(bob, { mutations: [mut({ id, op: 'delete', data: undefined })] });

    const mine = (await changes(alice)).json().changes.find((c: { id: string }) => c.id === id);
    expect(mine).toMatchObject({ deleted: false, data: { body: { name: 'Alice private' } } });
  });

  it('B replaying A\'s mutation id does not get A\'s answer', async () => {
    const m = mut();
    await push(alice, { mutations: [m] });
    const replay = await push(bob, { mutations: [{ ...m, id: randomUUID() }] });
    expect(replay.json().results[0]).toMatchObject({ status: 'applied' });
    expect((await changes(alice)).json().changes.filter((c: { id: string }) => c.id === m.id)).toHaveLength(1);
  });
});

describe('REST and sync see the same data', () => {
  it('an account made through REST appears in the feed, and one pushed appears in REST', async () => {
    const viaRest = randomUUID();
    await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${viaRest}`, headers: { cookie: alice, ...CSRF }, payload: { name: 'REST made' } });
    expect((await changes(alice)).json().changes.map((c: { id: string }) => c.id)).toContain(viaRest);

    const viaSync = randomUUID();
    await push(alice, { mutations: [mut({ id: viaSync, data: { body: { name: 'Sync made' } } })] });
    const res = await t.app.inject({ method: 'GET', url: `/api/v1/accounts/${viaSync}`, headers: { cookie: alice } });
    expect(res.json().name).toBe('Sync made');
  });
});

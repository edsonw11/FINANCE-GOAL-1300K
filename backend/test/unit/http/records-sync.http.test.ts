import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CSRF, type TestApp, createTestApp } from '../../support/http-app';

let t: TestApp;
let alice: string;
let bob: string;
let aliceId: string;

beforeAll(async () => {
  t = await createTestApp();
  alice = await t.login();
  t.provider.identity = { ...t.provider.identity, subject: 'sub-bob', email: 'bob@example.test', displayName: 'Bob' };
  bob = await t.login();
  aliceId = (await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: alice } })).json().id;
});
afterAll(async () => {
  await t.close();
});

const push = (cookie: string, mutations: unknown[]) => t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF }, payload: { mutations } });
const feed = async (cookie: string, cursor = '0') => (await t.app.inject({ method: 'GET', url: `/api/v1/sync/changes?cursor=${cursor}&limit=1000`, headers: { cookie } })).json();
const mut = (resource: string, over: Record<string, unknown> = {}) => ({ mutationId: randomUUID(), resource, op: 'put', id: randomUUID(), data: {}, ...over });
const tx = (extra: Record<string, unknown> = {}) => ({ id: 7, type: 'despesa', date: '2026-11-20', value: 12.5, cat: 'Mercado', ...extra });
const first = (res: { json: () => { results: { status: string; reason?: string }[] } }) => res.json().results[0]!;

describe('what a device finds in the feed', () => {
  it('a balance and an imported file keep exactly the body they were sent (they have no id of their own)', async () => {
    const snap = randomUUID();
    const imp = randomUUID();
    await push(alice, [mut('snap', { id: snap, data: { body: { date: '2026-11-21', acc: 'nu', value: 5 } } }), mut('import', { id: imp, data: { body: { hash: 'h-1' }, legacyKey: 'h-1' } })]);
    const changes = (await feed(alice)).changes as { id: string; data: { body: Record<string, unknown> } }[];
    expect(changes.find((c) => c.id === snap)!.data.body).toEqual({ date: '2026-11-21', acc: 'nu', value: 5 });
    expect(changes.find((c) => c.id === imp)!.data.body).toEqual({ hash: 'h-1' });
  });

  it('an account made through REST reaches a device with an id inside (its record id), so the device can find it again', async () => {
    const id = randomUUID();
    await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${id}`, headers: { cookie: alice, ...CSRF }, payload: { name: 'From REST' } });
    const change = (await feed(alice)).changes.find((c: { id: string }) => c.id === id);
    expect(change.data.body).toEqual({ name: 'From REST', id });
  });

  it('an account the device named keeps its own id', async () => {
    const id = randomUUID();
    await push(alice, [mut('account', { id, data: { body: { id: 'nu', name: 'Nubank', archived: true }, legacyKey: 'nu' } })]);
    expect((await feed(alice)).changes.find((c: { id: string }) => c.id === id).data.body).toEqual({ id: 'nu', name: 'Nubank', archived: true });
  });

  it('sync applies the same rules as an import: a bad date is refused', async () => {
    expect(first(await push(alice, [mut('tx', { data: { body: tx({ id: 800, date: 'yesterday' }), legacyKey: '800' } })]))).toMatchObject({ status: 'rejected', reason: 'invalid_data' });
  });
});

describe('transactions and the other lists through the sync', () => {
  it('a phone with no signal adds an expense, pushes it later, and the tablet gets it', async () => {
    const id = randomUUID();
    expect(first(await push(alice, [mut('tx', { id, data: { body: tx(), legacyKey: '7' } })]))).toMatchObject({ status: 'applied' });
    const change = (await feed(alice)).changes.find((c: { id: string }) => c.id === id);
    expect(change).toMatchObject({ resource: 'tx', deleted: false, data: { body: tx(), legacyKey: '7' } });
  });

  it('every kind syncs', async () => {
    const sent = [
      mut('snap', { data: { body: { date: '2026-11-20', acc: 'nu', value: 5 } } }),
      mut('trade', { data: { body: { id: 't1', ticker: 'X' }, legacyKey: 't1' } }),
      mut('transfer', { data: { body: { id: 3 }, legacyKey: '3' } }),
      mut('import', { data: { body: { hash: 'abc' }, legacyKey: 'abc' } }),
    ];
    expect((await push(alice, sent)).json().results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
  });

  it('editing and deleting reach the other device, and a late edit of a deleted one is superseded', async () => {
    const id = randomUUID();
    await push(alice, [mut('tx', { id, data: { body: tx({ id: 90 }), legacyKey: '90' } })]);
    const cursor = (await feed(alice)).cursor;
    await push(alice, [mut('tx', { id, data: { body: tx({ id: 90, value: 99 }), legacyKey: '90' } })]);
    expect((await feed(alice, cursor)).changes[0]).toMatchObject({ id, data: { body: { value: 99 } } });
    await push(alice, [mut('tx', { id, op: 'delete', data: undefined })]);
    expect((await feed(alice, cursor)).changes.find((c: { id: string }) => c.id === id)).toMatchObject({ deleted: true, data: null });
    expect(first(await push(alice, [mut('tx', { id, data: { body: tx({ id: 90 }) } })]))).toMatchObject({ status: 'superseded' });
  });

  it('a transaction the person sends is part of their stored state, and the shared rules count it', async () => {
    await push(alice, [mut('tx', { data: { body: { id: 501, type: 'receita', date: '2026-02-03', value: 1000, cat: 'Salário', desc: 'x', fonte: 'caixa' }, legacyKey: '501' } })]);
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/months/2026-02/summary', headers: { cookie: alice } });
    expect(res.json().income.total).toBe(1000);
  });

  describe('what is refused', () => {
    it.each([
      ['a transaction without a type', 'tx', { body: { date: '2026-01-01' } }],
      ['a transaction without a date', 'tx', { body: { type: 'despesa' } }],
      ['a balance without an account', 'snap', { body: { date: '2026-01-01', value: 1 } }],
      ['an import without a hash', 'import', { body: { name: 'x' } }],
      ['a body that is not an object', 'tx', { body: 'text' }],
      ['an extra field next to the body', 'tx', { body: tx(), admin: true }],
      ['no data', 'tx', undefined],
      ['a NUL in a text', 'tx', { body: tx({ desc: 'a\u0000b' }) }],
      ['too deep', 'tx', { body: tx({ deep: JSON.parse('{"a":'.repeat(15) + '1' + '}'.repeat(15)) }) }],
    ])('%s', async (_label, resource, data) => {
      const m = mut(resource, { data });
      expect(first(await push(bob, [m]))).toEqual({ mutationId: m.mutationId, status: 'rejected', reason: 'invalid_data' });
    });

    it('a __proto__ key never gets in: the whole request is refused by the JSON parser', async () => {
      const raw = '{"mutations":[{"mutationId":"' + randomUUID() + '","resource":"tx","op":"put","id":"' + randomUUID() + '","data":{"body":{"type":"a","date":"2026-01-01","__proto__":{"x":1}}}}]}';
      const res = await t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie: bob, ...CSRF, 'content-type': 'application/json' }, payload: raw });
      expect(res.statusCode).toBe(400);
      expect(({} as Record<string, unknown>).x).toBeUndefined();
    });

    it('an id that belongs to another person, and an id of another kind, are "not found"', async () => {
      const id = randomUUID();
      await push(alice, [mut('tx', { id, data: { body: tx({ id: 800 }), legacyKey: '800' } })]);
      expect(first(await push(bob, [mut('tx', { id, data: { body: tx() } })]))).toMatchObject({ status: 'rejected', reason: 'not_found' });
      expect(first(await push(alice, [mut('snap', { id, data: { body: { date: '2026-01-01', acc: 'a', value: 1 } } })]))).toMatchObject({ status: 'rejected', reason: 'not_found' });
      expect(first(await push(bob, [mut('tx', { id, op: 'delete', data: undefined })]))).toMatchObject({ status: 'applied' });
      expect((await feed(alice)).changes.find((c: { id: string }) => c.id === id)).toMatchObject({ deleted: false });
    });

    it('a legacy key that is already in use is refused, not silently merged', async () => {
      await push(alice, [mut('tx', { data: { body: tx({ id: 810 }), legacyKey: '810' } })]);
      expect(first(await push(alice, [mut('tx', { data: { body: tx({ id: 810 }), legacyKey: '810' } })]))).toMatchObject({ status: 'rejected', reason: 'invalid_data' });
    });
  });

  it('bob never sees alice\'s transactions in his feed', async () => {
    const seen = JSON.stringify(await feed(bob));
    expect(seen).not.toContain('Mercado');
  });
});

describe('the settings document through the sync', () => {
  it('is one record whose id is the person\'s id, last write wins as a whole', async () => {
    expect(first(await push(alice, [mut('state', { id: aliceId, data: { body: { goal: 500000, rate: 9 } } })]))).toMatchObject({ status: 'applied' });
    const change = (await feed(alice)).changes.find((c: { resource: string }) => c.resource === 'state');
    expect(change).toMatchObject({ id: aliceId, data: { body: { goal: 500000, rate: 9 } } });
  });

  it('is refused for any other id, for another person\'s id, and cannot be deleted', async () => {
    expect(first(await push(bob, [mut('state', { id: randomUUID(), data: { body: { goal: 1 } } })]))).toMatchObject({ status: 'rejected', reason: 'not_found' });
    expect(first(await push(bob, [mut('state', { id: aliceId, data: { body: { goal: 1 } } })]))).toMatchObject({ status: 'rejected', reason: 'not_found' });
    expect(first(await push(alice, [mut('state', { id: aliceId, op: 'delete', data: undefined })]))).toMatchObject({ status: 'rejected' });
  });

  it('changing the settings the same way twice makes no new version', async () => {
    await push(alice, [mut('state', { id: aliceId, data: { body: { goal: 777 } } })]);
    const cursor = (await feed(alice)).cursor;
    await push(alice, [mut('state', { id: aliceId, data: { body: { goal: 777 } } })]);
    expect((await feed(alice, cursor)).changes).toEqual([]);
  });

  it('the shared rules read the settings a device pushed', async () => {
    await push(alice, [mut('state', { id: aliceId, data: { body: { v: 2, goal: 42, rate: 5, planned: 0, nid: 1 } } })]);
    const exported = await t.app.inject({ method: 'GET', url: '/api/v1/export/legacy-state', headers: { cookie: alice } });
    expect(exported.json()).toMatchObject({ goal: 42, rate: 5 });
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CSRF, type TestApp, createTestApp } from '../../support/http-app';

let t: TestApp;
let alice: string;
let bob: string;

beforeAll(async () => {
  t = await createTestApp();
  alice = await t.login();
  t.provider.identity = { ...t.provider.identity, subject: 'sub-bob', email: 'bob@example.test', displayName: 'Bob' };
  bob = await t.login();
});
afterAll(async () => {
  await t.close();
});

const ID = (n: number) => `0190a1b2-0000-7000-8000-${String(n).padStart(12, '0')}`;
const put = (cookie: string, id: string, body: unknown, headers: Record<string, string> = {}) =>
  t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${id}`, headers: { cookie, ...CSRF, ...headers }, payload: body as object });
const get = (cookie: string, id = '') => t.app.inject({ method: 'GET', url: `/api/v1/accounts${id ? `/${id}` : ''}`, headers: { cookie } });
const del = (cookie: string, id: string) => t.app.inject({ method: 'DELETE', url: `/api/v1/accounts/${id}`, headers: { cookie, ...CSRF } });

describe('accounts: the basics', () => {
  it('creates, reads, lists and renames', async () => {
    const created = await put(alice, ID(1), { name: 'Checking' });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ id: ID(1), name: 'Checking' });
    expect((await get(alice, ID(1))).json().name).toBe('Checking');
    expect((await get(alice)).json().items.map((a: { id: string }) => a.id)).toContain(ID(1));
    expect((await put(alice, ID(1), { name: 'Main account' })).json().name).toBe('Main account');
  });

  it('sending the same request twice is the same result (an offline retry is safe)', async () => {
    const a = await put(alice, ID(2), { name: 'Wallet' });
    const b = await put(alice, ID(2), { name: 'Wallet' });
    expect(b.statusCode).toBe(200);
    expect(b.json().id).toBe(a.json().id);
    const list = (await get(alice)).json().items.filter((x: { id: string }) => x.id === ID(2));
    expect(list).toHaveLength(1);
  });

  it('trims the name', async () => {
    expect((await put(alice, ID(3), { name: '  Savings  ' })).json().name).toBe('Savings');
  });

  it('deleting answers 204 and the record is gone, then 410 for a late edit', async () => {
    await put(alice, ID(4), { name: 'Old' });
    expect((await del(alice, ID(4))).statusCode).toBe(204);
    expect((await get(alice, ID(4))).statusCode).toBe(404);
    expect((await put(alice, ID(4), { name: 'Late edit' })).statusCode).toBe(410);
    expect((await del(alice, ID(4))).statusCode).toBe(204);
  });

  it('deleting something that never existed is 204 too', async () => {
    expect((await del(alice, ID(999))).statusCode).toBe(204);
  });
});

describe('accounts: person B cannot touch what person A owns (IDOR / BOLA)', () => {
  it('B cannot read, list, rename or delete A\'s account, and nothing is revealed', async () => {
    await put(alice, ID(10), { name: 'Alice private' });

    const read = await get(bob, ID(10));
    expect(read.statusCode).toBe(404);
    expect(read.body).not.toContain('Alice private');

    expect((await get(bob)).json().items.map((a: { id: string }) => a.id)).not.toContain(ID(10));

    const edit = await put(bob, ID(10), { name: 'Hacked' });
    expect(edit.statusCode).toBe(404);

    expect((await del(bob, ID(10))).statusCode).toBe(204); // same answer as for an unknown id

    const still = await get(alice, ID(10));
    expect(still.statusCode).toBe(200);
    expect(still.json().name).toBe('Alice private');
  });

  it('B getting 404 for A\'s id is the same as for an id nobody has: no way to tell them apart', async () => {
    const theirs = await get(bob, ID(10));
    const nobody = await get(bob, ID(88888));
    expect(theirs.statusCode).toBe(nobody.statusCode);
    expect(theirs.json()).toEqual(nobody.json());
  });

  it('B cannot take over the id by creating it first or later', async () => {
    await put(bob, ID(11), { name: 'Bob first' });
    expect((await put(alice, ID(11), { name: 'Alice second' })).statusCode).toBe(404);
    expect((await get(bob, ID(11))).json().name).toBe('Bob first');
  });

  it('a user id sent in the body, query or header is not used', async () => {
    const res = await t.app.inject({
      method: 'PUT',
      url: `/api/v1/accounts/${ID(12)}?userId=x`,
      headers: { cookie: bob, ...CSRF, 'x-user-id': 'x' },
      payload: { name: 'Mine', userId: 'alice' },
    });
    expect(res.statusCode).toBe(400); // unknown field refused
    const ok = await put(bob, ID(12), { name: 'Mine' });
    expect(ok.statusCode).toBe(200);
    expect((await get(alice, ID(12))).statusCode).toBe(404);
  });

  it('B deleting A\'s id does not stop A from keeping it', async () => {
    await put(alice, ID(13), { name: 'Keep' });
    await del(bob, ID(13));
    expect((await put(alice, ID(13), { name: 'Keep 2' })).statusCode).toBe(200);
  });
});

describe('accounts: protections', () => {
  it('needs a login', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/accounts' })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${ID(20)}`, headers: CSRF, payload: { name: 'x' } })).statusCode).toBe(401);
  });

  it('a change from another origin is refused even with a good cookie', async () => {
    const res = await put(alice, ID(21), { name: 'x' }, { origin: 'http://evil.example' });
    expect(res.statusCode).toBe(403);
    expect((await get(alice, ID(21))).statusCode).toBe(404);
  });

  it('a change without the CSRF header is refused', async () => {
    const res = await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${ID(22)}`, headers: { cookie: alice, origin: 'http://localhost:3000' }, payload: { name: 'x' } });
    expect(res.statusCode).toBe(403);
  });

  it.each(['1', 'not-a-uuid', 'DROP TABLE', '../../etc', '0190a1b2-0000-7000-8000-00000000000g', '0190a1b2-0000-7000-8000-0000000000011'])('id %s is 400', async (id) => {
    expect((await get(alice, encodeURIComponent(id))).statusCode).toBe(400);
    expect((await put(alice, encodeURIComponent(id), { name: 'x' })).statusCode).toBe(400);
  });

  it.each([
    ['no body', undefined],
    ['empty object', {}],
    ['blank name', { name: '   ' }],
    ['name too long', { name: 'a'.repeat(81) }],
    ['name is a number', { name: 5 }],
    ['name is an object', { name: { $ne: '' } }],
    ['name is an array', { name: ['a'] }],
    ['extra field', { name: 'x', admin: true }],
    ['control character', { name: 'a\u0000b' }],
    ['newline', { name: 'a\nb' }],
    ['array body', ['x']],
  ])('refuses %s with 400', async (_label, body) => {
    const res = await put(alice, ID(30), body);
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('$ne');
    expect((await get(alice, ID(30))).statusCode).toBe(404);
  });

  it('accepts a name of exactly 80 characters, and emoji, and refuses a broken pair', async () => {
    expect((await put(alice, ID(31), { name: 'a'.repeat(80) })).statusCode).toBe(200);
    expect((await put(alice, ID(32), { name: '💰 Savings' })).statusCode).toBe(200);
    const broken = await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${ID(33)}`, headers: { cookie: alice, ...CSRF, 'content-type': 'application/json' }, payload: '{"name":"a\\ud800b"}' });
    expect(broken.statusCode).toBe(400);
  });

  it('malformed JSON is 400, not 500', async () => {
    const res = await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${ID(34)}`, headers: { cookie: alice, ...CSRF, 'content-type': 'application/json' }, payload: '{"name":' });
    expect(res.statusCode).toBe(400);
  });

  it('a body that is not JSON is refused and nothing is stored', async () => {
    const res = await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${ID(35)}`, headers: { cookie: alice, ...CSRF, 'content-type': 'text/plain' }, payload: 'name=x' });
    expect([400, 415]).toContain(res.statusCode);
    expect((await get(alice, ID(35))).statusCode).toBe(404);
  });

  it('a body over the limit is refused with 413', async () => {
    const res = await t.app.inject({ method: 'PUT', url: `/api/v1/accounts/${ID(36)}`, headers: { cookie: alice, ...CSRF, 'content-type': 'application/json' }, payload: JSON.stringify({ name: 'a'.repeat(2 * 1024 * 1024) }) });
    expect(res.statusCode).toBe(413);
  });

  it('answers are never cached', async () => {
    expect((await get(alice)).headers['cache-control']).toBe('no-store');
  });
});

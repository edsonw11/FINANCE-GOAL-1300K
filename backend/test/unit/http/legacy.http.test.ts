import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GOLDEN_FILE, goldenState } from '../../contracts/golden.contract';
import { CSRF, type TestApp, createTestApp } from '../../support/http-app';

let t: TestApp;
let alice: string;
let bob: string;
let aliceId: string;

const idOf = async (cookie: string) => (await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).json().id as string;
const importState = (cookie: string, body: unknown, query = '') =>
  t.app.inject({ method: 'POST', url: `/api/v1/import/legacy-state${query}`, headers: { cookie, ...CSRF, 'content-type': 'application/json' }, payload: typeof body === 'string' ? body : JSON.stringify(body) });
const exportState = (cookie: string) => t.app.inject({ method: 'GET', url: '/api/v1/export/legacy-state', headers: { cookie } });
/** A person nobody has used yet. Every test also gets its own application and its own storage, so nothing is left behind by another test. */
let extra = 0;
const newPerson = async () => {
  t.provider.identity = { ...t.provider.identity, subject: `sub-fresh-${++extra}`, email: null, displayName: null };
  return t.login();
};
const month = (cookie: string, m: string, what: string, query = '') => t.app.inject({ method: 'GET', url: `/api/v1/months/${m}/${what}${query}`, headers: { cookie } });

// A new application, storage and people for EVERY test: no test depends on what another one stored.
beforeEach(async () => {
  t = await createTestApp();
  alice = await t.login();
  t.provider.identity = { ...t.provider.identity, subject: 'sub-bob', email: 'bob@example.test', displayName: 'Bob' };
  bob = await t.login();
  aliceId = await idOf(alice);
});
afterEach(async () => {
  await t.close();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('protections', () => {
  it('needs a login', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/export/legacy-state' })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'POST', url: '/api/v1/import/legacy-state', headers: CSRF, payload: {} })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/months/2026-10/result' })).statusCode).toBe(401);
  });

  it('the import is refused without the CSRF protections', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/import/legacy-state', headers: { cookie: alice }, payload: goldenState() });
    expect(res.statusCode).toBe(403);
    expect((await exportState(alice)).statusCode).toBe(404);
  });

  it('answers are never cached', async () => {
    expect((await exportState(alice)).headers['cache-control']).toBe('no-store');
  });
});

describe('import and export', () => {
  it('an empty person has nothing to export', async () => {
    expect((await exportState(await newPerson())).statusCode).toBe(404);
  });

  it('imports the baseline state, says what it stored, and exports exactly the same', async () => {
    const original = goldenState();
    const res = await importState(alice, original);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ records: 28, byKind: { account: 2, snap: 6, tx: 20, trade: 0, transfer: 0, import: 0 } });
    expect((await exportState(alice)).json()).toEqual(original);
  });

  it('a second import is 409 and changes nothing; with replace=true it works', async () => {
    expect((await importState(alice, goldenState())).statusCode).toBe(200);
    const again = await importState(alice, goldenState());
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ code: 'not_empty' });
    expect((await importState(alice, goldenState(), '?replace=true')).statusCode).toBe(200);
    expect((await exportState(alice)).json()).toEqual(goldenState());
  });

  it('replace must be true or false', async () => {
    expect((await importState(alice, goldenState(), '?replace=maybe')).statusCode).toBe(400);
    expect((await importState(alice, goldenState(), '?other=1')).statusCode).toBe(400);
  });

  it('another person never sees it, and importing theirs does not touch it', async () => {
    await importState(alice, goldenState());
    expect((await exportState(bob)).statusCode).toBe(404);
    const theirs = goldenState();
    (theirs.accounts as { name: string }[])[0]!.name = 'Bob account';
    await importState(bob, theirs);
    expect(JSON.stringify((await exportState(alice)).json())).not.toContain('Bob account');
    expect(JSON.stringify((await exportState(bob)).json())).toContain('Bob account');
    expect((await importState(bob, { v: 2, goal: 1 }, '?replace=true')).statusCode).toBe(200);
    expect((await exportState(alice)).json()).toEqual(goldenState());
  });

  it.each([
    ['not an object', '[]'],
    ['a list that is not a list', JSON.stringify({ tx: 5 })],
    ['a transaction without a date', JSON.stringify({ tx: [{ id: 1, type: 'despesa' }] })],
    ['a __proto__ key', '{"v":2,"tx":[{"id":1,"type":"despesa","date":"2026-01-01","__proto__":{"x":1}}]}'],
    ['a __proto__ key in the settings', '{"v":2,"__proto__":{"admin":true}}'],
    ['the same id twice', JSON.stringify({ tx: [{ id: 1, type: 'a', date: '2026-01-01' }, { id: 1, type: 'a', date: '2026-01-02' }] })],
    ['a NUL in a text', JSON.stringify({ tx: [{ id: 1, type: 'a', date: '2026-01-01', desc: 'x\u0000y' }] })],
  ])('refuses %s with 400 and stores nothing', async (label, body) => {
    const person = await newPerson();
    const res = await importState(person, body);
    expect(res.statusCode).toBe(400);
    // a __proto__ key is already refused by the JSON parser itself, before any of our code (a second layer)
    if (!String(label).includes('__proto__')) expect(res.json().issues.length).toBeGreaterThan(0);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    expect((await exportState(person)).statusCode).toBe(404);
  });

  it('malformed JSON is 400, and a body that is not JSON is refused', async () => {
    const person = await newPerson();
    expect((await importState(person, '{"tx":')).statusCode).toBe(400);
    const text = await t.app.inject({ method: 'POST', url: '/api/v1/import/legacy-state', headers: { cookie: person, ...CSRF, 'content-type': 'text/plain' }, payload: 'tx=1' });
    expect([400, 415]).toContain(text.statusCode);
  });

  it('a history bigger than the ordinary limit is accepted here (1 MB limit elsewhere), and a huge one is refused', async () => {
    const tx = Array.from({ length: 12_000 }, (_, i) => ({ id: i + 1, type: 'despesa', date: '2026-01-01', value: i, cat: 'Mercado', desc: `compra ${i}`, fonte: 'caixa' }));
    const big = JSON.stringify({ v: 2, goal: 1, tx });
    expect(big.length).toBeGreaterThan(1024 * 1024);
    const ok = await importState(bob, big, '?replace=true');
    expect(ok.statusCode).toBe(200);
    expect(ok.json().byKind.tx).toBe(12_000);
    const tooBig = await importState(bob, JSON.stringify({ v: 2, note: 'a'.repeat(26 * 1024 * 1024) }));
    expect(tooBig.statusCode).toBe(413);
    // other routes keep the ordinary limit
    const other = await t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie: bob, ...CSRF }, payload: { mutations: [{ mutationId: randomUUID(), resource: 'tx', op: 'put', id: randomUUID(), data: { body: { note: 'a'.repeat(2 * 1024 * 1024) } } }] } });
    expect(other.statusCode).toBe(413);
    await importState(bob, { v: 2, goal: 1 }, '?replace=true');
  });
});

describe('the months, calculated by the shared rules on the person\'s data', () => {
  // each test starts from alice holding the baseline state (the outer beforeEach has made a fresh application)
  beforeEach(async () => {
    expect((await importState(alice, goldenState())).statusCode).toBe(200);
  });

  it('month results are the baseline\'s numbers (through HTTP)', async () => {
    const golden = GOLDEN_FILE as { monthResult: { m: string }[]; report: unknown };
    for (const expected of golden.monthResult) {
      const res = await month(alice, expected.m, 'result');
      expect(res.statusCode, expected.m).toBe(200);
      expect({ m: expected.m, ...res.json() }).toEqual(expected);
    }
  });

  it('the monthly report is a Pro feature: locked on free, the baseline\'s numbers on pro', async () => {
    const locked = await month(alice, '2026-10', 'report', '?today=2026-11-20');
    expect(locked.statusCode).toBe(403);
    expect(locked.json()).toMatchObject({ code: 'feature_locked', feature: 'report.monthly' });
    t.plans.userPlans.set(aliceId, 'pro');
    const res = await month(alice, '2026-10', 'report', '?today=2026-11-20');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual((GOLDEN_FILE as { report: unknown }).report);
    t.plans.userPlans.set(aliceId, 'free');
  });

  it('a person with no data gets zeros, not an error, and never someone else\'s numbers', async () => {
    const res = await month(await newPerson(), '2026-10', 'summary');
    expect(res.statusCode).toBe(200);
    expect(res.json().income.total).toBe(0);
    const mine = await month(alice, '2026-10', 'summary');
    expect(mine.json().income.total).toBe(8200);
  });

  it.each(['2026-13', '2026-00', '26-10', '2026-1', '2026-10-01', 'abc', '2026-10%20', '..%2F..'])('refuses the month %s', async (m) => {
    expect((await month(alice, m, 'result')).statusCode).toBe(400);
  });

  it('refuses a bad "today" and unknown parameters', async () => {
    t.plans.userPlans.set(aliceId, 'pro');
    expect((await month(alice, '2026-10', 'report', '?today=tomorrow')).statusCode).toBe(400);
    expect((await month(alice, '2026-10', 'report', '?x=1')).statusCode).toBe(400);
    t.plans.userPlans.set(aliceId, 'free');
  });

  it('a sparse stored state (no lists, no goal) still calculates: the rules get the blank state\'s defaults', async () => {
    const person = await newPerson();
    await importState(person, { v: 2 });
    const res = await month(person, '2026-10', 'result');
    expect(res.statusCode).toBe(200);
    expect((await exportState(person)).json()).toEqual({ v: 2 }); // and what was stored is still exactly what was sent
  });

  it('the answer follows the data: after a replace the numbers change at once', async () => {
    const changed = goldenState();
    (changed.tx as { type: string; date: string; value: number }[]).forEach((x) => {
      if (x.type === 'receita' && x.date.startsWith('2026-10')) x.value = 1;
    });
    await importState(alice, changed, '?replace=true');
    expect((await month(alice, '2026-10', 'summary')).json().income.total).toBe(1);
    await importState(alice, goldenState(), '?replace=true');
    expect((await month(alice, '2026-10', 'summary')).json().income.total).toBe(8200);
  });
});

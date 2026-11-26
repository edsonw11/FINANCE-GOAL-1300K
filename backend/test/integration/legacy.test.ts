import { randomUUID } from 'node:crypto';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { OIDC_PROVIDER } from '../../src/auth/oidc-provider';
import { configureApp, createAdapter } from '../../src/create-app';
import { GOLDEN_FILE, goldenState } from '../contracts/golden.contract';
import { FakeOidcProvider } from '../support/fakes';
import { CSRF } from '../support/http-app';
import { testConfig, withClient } from './support';

// The whole product path on the real PostgreSQL: import a history, pull it from another device, calculate through the rules.
const ISSUER = 'http://idp.test/legacy';
let app: NestFastifyApplication;
const provider = new FakeOidcProvider();
const config = testConfig();
const cleanup = () => withClient((c) => c.query('DELETE FROM app_user WHERE oidc_issuer = $1', [ISSUER]));

beforeAll(async () => {
  await cleanup();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).overrideProvider(OIDC_PROVIDER).useValue(provider).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(), { logger: false });
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterAll(async () => {
  await app?.close();
  await cleanup();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T12:00:00'));
});
afterEach(() => vi.useRealTimers());

const cookieOf = (headers: Record<string, unknown>, name: string) => {
  const v = headers['set-cookie'];
  return (Array.isArray(v) ? (v as string[]) : [String(v)]).find((c) => c.startsWith(`${name}=`))?.split(';')[0];
};
let queue: Promise<unknown> = Promise.resolve();
function loginAs(subject: string): Promise<string> {
  const run = queue.then(async () => {
    provider.identity = { issuer: ISSUER, subject, email: null, displayName: null };
    const start = await app.inject({ method: 'GET', url: '/auth/login' });
    const flow = cookieOf(start.headers, config.cookies.flowName)!;
    const back = await app.inject({ method: 'GET', url: provider.callbackFor(), headers: { cookie: flow } });
    return cookieOf(back.headers, config.cookies.sessionName)!;
  });
  queue = run.catch(() => undefined);
  return run;
}
const person = () => loginAs(`p-${randomUUID()}`);
const importState = (cookie: string, body: unknown, query = '') =>
  app.inject({ method: 'POST', url: `/api/v1/import/legacy-state${query}`, headers: { cookie, ...CSRF, 'content-type': 'application/json' }, payload: JSON.stringify(body) });
const feed = async (cookie: string, cursor = '0') =>
  (await app.inject({ method: 'GET', url: `/api/v1/sync/changes?cursor=${cursor}&limit=1000`, headers: { cookie } })).json() as { changes: { id: string; resource: string; deleted: boolean; version: number }[]; cursor: string; hasMore: boolean };

describe('import, pull and calculate on PostgreSQL', () => {
  it('imports the baseline over HTTP, another device pulls all of it, and the rules give the golden numbers', async () => {
    const subject = `golden-${randomUUID()}`;
    const [phone, tablet] = [await loginAs(subject), await loginAs(subject)];
    expect((await importState(phone, goldenState())).statusCode).toBe(200);

    const pulled = await feed(tablet);
    const counts = pulled.changes.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.resource]: (acc[c.resource] ?? 0) + 1 }), {});
    expect(counts).toEqual({ account: 2, snap: 6, tx: 20, state: 1 });
    const versions = pulled.changes.map((c) => c.version);
    expect(new Set(versions).size).toBe(versions.length);

    for (const expected of (GOLDEN_FILE as { monthResult: { m: string }[] }).monthResult) {
      const res = await app.inject({ method: 'GET', url: `/api/v1/months/${expected.m}/result`, headers: { cookie: tablet } });
      expect({ m: expected.m, ...res.json() }).toEqual(expected);
    }
    expect((await app.inject({ method: 'GET', url: '/api/v1/export/legacy-state', headers: { cookie: tablet } })).json()).toEqual(goldenState());
  });

  it('a replace tells the other device what disappeared, and the new data takes the same keys again', async () => {
    const subject = `replace-${randomUUID()}`;
    const [phone, tablet] = [await loginAs(subject), await loginAs(subject)];
    await importState(phone, goldenState());
    const cursor = (await feed(tablet)).cursor;
    expect((await importState(phone, goldenState(), '?replace=true')).statusCode).toBe(200);
    const after = await feed(tablet, cursor);
    expect(after.changes.filter((c) => c.deleted && c.resource === 'tx')).toHaveLength(20);
    expect(after.changes.filter((c) => !c.deleted && c.resource === 'tx')).toHaveLength(20);
    const live = await app.inject({ method: 'GET', url: '/api/v1/export/legacy-state', headers: { cookie: tablet } });
    expect(live.json().tx).toHaveLength(20);
  });

  it('two imports at the same moment: exactly one wins, the other is told it is not empty', async () => {
    const subject = `race-${randomUUID()}`;
    const [a, b] = [await loginAs(subject), await loginAs(subject)];
    const [ra, rb] = await Promise.all([importState(a, goldenState()), importState(b, goldenState())]);
    expect([ra.statusCode, rb.statusCode].sort()).toEqual([200, 409]);
    const { rows } = await withClient((c) => c.query("SELECT count(*)::int AS n FROM record WHERE user_id = (SELECT id FROM app_user WHERE oidc_subject = $1) AND kind = 'tx' AND deleted_at IS NULL", [subject]));
    expect(rows[0].n).toBe(20);
  });

  it('a long history (20 000 transactions) imports in one request, in order, with a version each', async () => {
    const cookie = await person();
    const tx = Array.from({ length: 20_000 }, (_, i) => ({ id: i + 1, type: 'despesa', date: '2026-03-04', value: i % 500, cat: 'Mercado', desc: `compra ${i}`, fonte: 'caixa' }));
    const started = Date.now();
    const res = await importState(cookie, { v: 2, goal: 1, rate: 1, planned: 0, nid: 20_001, accounts: [], snaps: [], tx });
    expect(res.statusCode).toBe(200);
    expect(Date.now() - started).toBeLessThan(20_000);
    const exported = (await app.inject({ method: 'GET', url: '/api/v1/export/legacy-state', headers: { cookie } })).json() as { tx: { id: number }[] };
    expect(exported.tx.map((t) => t.id)).toEqual(tx.map((t) => t.id));
  });

  it('a transaction pushed from a device is counted by the rules, and a deleted one stops being counted', async () => {
    const cookie = await person();
    await importState(cookie, { v: 2, goal: 1, rate: 1, planned: 0, nid: 2, accounts: [], snaps: [], tx: [] });
    const id = randomUUID();
    const put = (data?: unknown, op = 'put') => app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF }, payload: { mutations: [{ mutationId: randomUUID(), resource: 'tx', op, id, data }] } });
    await put({ body: { id: 1, type: 'receita', date: '2026-05-02', value: 250, cat: 'Salário', desc: 'x', fonte: 'caixa' }, legacyKey: '1' });
    const income = async () => (await app.inject({ method: 'GET', url: '/api/v1/months/2026-05/summary', headers: { cookie } })).json().income.total;
    expect(await income()).toBe(250);
    await put(undefined, 'delete');
    expect(await income()).toBe(0);
  });

  it('one person\'s import never changes another person\'s numbers', async () => {
    const [a, b] = [await person(), await person()];
    await importState(a, goldenState());
    const other = goldenState();
    (other.tx as { value: number }[]).forEach((t) => (t.value = 1));
    await importState(b, other);
    const income = async (cookie: string) => (await app.inject({ method: 'GET', url: '/api/v1/months/2026-10/summary', headers: { cookie } })).json().income.total;
    expect([await income(a), await income(b)]).toEqual([8200, 1]);
  });
});

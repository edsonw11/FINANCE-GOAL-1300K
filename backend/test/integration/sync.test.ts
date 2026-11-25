import { randomUUID } from 'node:crypto';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { OIDC_PROVIDER } from '../../src/auth/oidc-provider';
import { configureApp, createAdapter } from '../../src/create-app';
import { FakeOidcProvider } from '../support/fakes';
import { CSRF } from '../support/http-app';
import { testConfig, withClient } from './support';

// The sync on the real PostgreSQL (only the identity provider is scripted): ordering, retries and races.
const ISSUER = 'http://idp.test/sync';
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

const cookieOf = (headers: Record<string, unknown>, name: string) => {
  const v = headers['set-cookie'];
  return (Array.isArray(v) ? (v as string[]) : [String(v)]).find((c) => c.startsWith(`${name}=`))?.split(';')[0];
};
/** A new login each time: it is a new device of the same person, or another person. */
let loginQueue: Promise<unknown> = Promise.resolve();
/** One login at a time: the scripted provider remembers only the last attempt. */
function loginAs(subject: string): Promise<string> {
  const run = loginQueue.then(() => loginNow(subject));
  loginQueue = run.catch(() => undefined);
  return run;
}
async function loginNow(subject: string): Promise<string> {
  provider.identity = { issuer: ISSUER, subject, email: null, displayName: null };
  const start = await app.inject({ method: 'GET', url: '/auth/login' });
  const flow = cookieOf(start.headers, config.cookies.flowName)!;
  const back = await app.inject({ method: 'GET', url: provider.callbackFor(), headers: { cookie: flow } });
  return cookieOf(back.headers, config.cookies.sessionName)!;
}

const mut = (over: Record<string, unknown> = {}) => ({ mutationId: randomUUID(), resource: 'account', op: 'put', id: randomUUID(), data: { name: 'x' }, ...over });
const push = (cookie: string, mutations: unknown[]) => app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF }, payload: { mutations } });
const feed = async (cookie: string, cursor = '0', limit = 1000) =>
  (await app.inject({ method: 'GET', url: `/api/v1/sync/changes?cursor=${cursor}&limit=${limit}`, headers: { cookie } })).json() as {
    changes: { id: string; version: number; deleted: boolean; data: { name: string } | null }[];
    cursor: string;
    hasMore: boolean;
  };

describe('sync on PostgreSQL', () => {
  it('two devices: A works offline and pushes, B pulls, B edits, A pulls', async () => {
    const subject = `dev-${randomUUID()}`;
    const [phone, tablet] = [await loginAs(subject), await loginAs(subject)];
    const [x, y] = [randomUUID(), randomUUID()];
    expect((await push(phone, [mut({ id: x, data: { name: 'coffee' } }), mut({ id: y, data: { name: 'bus' } })])).statusCode).toBe(200);

    const tabletView = await feed(tablet);
    expect(tabletView.changes.map((c) => c.id)).toEqual([x, y]);
    await push(tablet, [mut({ id: x, data: { name: 'coffee (edited)' } }), mut({ id: y, op: 'delete', data: undefined })]);

    const phoneView = await feed(phone, '2');
    expect(phoneView.changes.map((c) => [c.id, c.deleted, c.data?.name ?? null])).toEqual([
      [x, false, 'coffee (edited)'],
      [y, true, null],
    ]);
    expect((await feed(phone, phoneView.cursor)).changes).toEqual([]);
  });

  it('the same batch sent 10 times at once changes the data once', async () => {
    const cookie = await loginAs(`retry-${randomUUID()}`);
    const batch = [mut(), mut(), mut()];
    const answers = await Promise.all(Array.from({ length: 10 }, () => push(cookie, batch)));
    expect(answers.every((r) => r.statusCode === 200)).toBe(true);
    const first = JSON.stringify(answers[0]!.json());
    expect(answers.every((r) => JSON.stringify(r.json()) === first)).toBe(true);
    const view = await feed(cookie);
    expect(view.changes).toHaveLength(3);
    expect(view.changes.map((c) => c.version)).toEqual([1, 2, 3]);
  });

  it('versions of one person are 1..n with no repeat, even with many devices writing together', async () => {
    const subject = `many-${randomUUID()}`;
    const devices = await Promise.all(Array.from({ length: 5 }, () => loginAs(subject)));
    await Promise.all(devices.flatMap((cookie) => Array.from({ length: 8 }, () => push(cookie, [mut()]))));
    const view = await feed(devices[0]!);
    expect(view.changes).toHaveLength(40);
    expect(view.changes.map((c) => c.version)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it('a reader paging while writers write never misses a change', async () => {
    const subject = `race-${randomUUID()}`;
    const [reader, ...writers] = (await Promise.all(Array.from({ length: 5 }, () => loginAs(subject)))) as [string, ...string[]];
    const written = new Set<string>();
    let writing = true;

    const write = async (cookie: string) => {
      for (let i = 0; i < 15; i++) {
        const m = mut();
        const res = await push(cookie, [m]);
        if (res.json().results[0].status === 'applied') written.add(m.id);
      }
    };
    const seen = new Set<string>();
    let cursor = '0';
    const read = async () => {
      while (writing) {
        const page = await feed(reader, cursor, 7);
        page.changes.forEach((c) => seen.add(c.id));
        cursor = page.cursor;
      }
    };
    const readerDone = read();
    await Promise.all(writers.slice(0, 4).map(write));
    writing = false;
    await readerDone;
    // one last catch-up, as the device would do on its next sync
    for (let guard = 0; guard < 100; guard++) {
      const page = await feed(reader, cursor, 7);
      page.changes.forEach((c) => seen.add(c.id));
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(written.size).toBe(60);
    expect([...written].filter((id) => !seen.has(id))).toEqual([]);
  });

  it('two people pushing the same record id at once: one wins, the other is told not_found, both feeds stay clean', async () => {
    const [a, b] = [await loginAs(`same-a-${randomUUID()}`), await loginAs(`same-b-${randomUUID()}`)];
    const id = randomUUID();
    const [ra, rb] = await Promise.all([push(a, [mut({ id, data: { name: 'A' } })]), push(b, [mut({ id, data: { name: 'B' } })])]);
    const statuses = [ra, rb].map((r) => r.json().results[0].status).sort();
    expect(statuses).toEqual(['applied', 'rejected']);
    const owners = [(await feed(a)).changes.length, (await feed(b)).changes.length].sort();
    expect(owners).toEqual([0, 1]);
  });

  it('delete and a late edit sent together: the delete wins, whatever the order they arrive in', async () => {
    const cookie = await loginAs(`dw-${randomUUID()}`);
    const id = randomUUID();
    await push(cookie, [mut({ id })]);
    await Promise.all([push(cookie, [mut({ id, data: { name: 'late edit' } })]), push(cookie, [mut({ id, op: 'delete', data: undefined })])]);
    const view = await feed(cookie);
    expect(view.changes.find((c) => c.id === id)).toMatchObject({ deleted: true });
    await push(cookie, [mut({ id, data: { name: 'later still' } })]);
    expect((await feed(cookie)).changes.find((c) => c.id === id)).toMatchObject({ deleted: true });
  });

  it('an edit to the same name changes no version, so a retry makes no noise in other devices', async () => {
    const cookie = await loginAs(`noop-${randomUUID()}`);
    const id = randomUUID();
    await push(cookie, [mut({ id, data: { name: 'Same' } })]);
    await push(cookie, [mut({ id, data: { name: 'Same' } })]);
    expect((await feed(cookie, '1')).changes).toEqual([]);
  });

  it('keeps the first answer in the database, and removes it with the person', async () => {
    const subject = `log-${randomUUID()}`;
    const cookie = await loginAs(subject);
    const m = mut();
    await push(cookie, [m]);
    const { rows } = await withClient((c) => c.query('SELECT outcome FROM sync_mutation WHERE mutation_id = $1', [m.mutationId]));
    expect(rows[0].outcome).toMatchObject({ status: 'applied', version: 1 });
    await withClient((c) => c.query('DELETE FROM app_user WHERE oidc_subject = $1', [subject]));
    expect((await withClient((c) => c.query('SELECT 1 FROM sync_mutation WHERE mutation_id = $1', [m.mutationId]))).rows).toHaveLength(0);
    expect((await withClient((c) => c.query('SELECT 1 FROM sync_cursor sc LEFT JOIN app_user u ON u.id = sc.user_id WHERE u.id IS NULL'))).rows).toHaveLength(0);
  });
});

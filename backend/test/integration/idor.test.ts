import { randomUUID } from 'node:crypto';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { OIDC_PROVIDER } from '../../src/auth/oidc-provider';
import { configureApp, createAdapter } from '../../src/create-app';
import { CSRF } from '../support/http-app';
import { FakeOidcProvider } from '../support/fakes';
import { testConfig, withClient } from './support';

// The whole application with the real PostgreSQL: only the identity provider is scripted.
// Person B must not be able to read or change what person A owns, through the real repositories and constraints.
const ISSUER = 'http://idp.test/idor';
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

async function loginAs(subject: string): Promise<string> {
  provider.identity = { issuer: ISSUER, subject, email: `${subject}@example.test`, displayName: subject };
  const start = await app.inject({ method: 'GET', url: '/auth/login' });
  const flow = cookieOf(start.headers, config.cookies.flowName)!;
  const back = await app.inject({ method: 'GET', url: provider.callbackFor(), headers: { cookie: flow } });
  const session = cookieOf(back.headers, config.cookies.sessionName);
  if (!session) throw new Error(`login failed: ${back.statusCode} ${back.headers.location}`);
  return session;
}

describe('login with the real database', () => {
  it('creates the person once, and /me says who they are', async () => {
    const subject = `once-${randomUUID()}`;
    const first = await loginAs(subject);
    const second = await loginAs(subject);
    const [a, b] = await Promise.all([first, second].map((cookie) => app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })));
    expect(a!.json().id).toBe(b!.json().id);
    expect(a!.json().email).toBe(`${subject}@example.test`);
    const { rows } = await withClient((c) => c.query('SELECT count(*)::int AS n FROM app_user WHERE oidc_issuer = $1 AND oidc_subject = $2', [ISSUER, subject]));
    expect(rows[0].n).toBe(1);
  });

  it('two people logging in at the same time are two rows, and the same person twice at once is one', async () => {
    const subject = `race-${randomUUID()}`;
    const cookies = await Promise.all(Array.from({ length: 8 }, () => loginAs(subject).catch(() => null)));
    const { rows } = await withClient((c) => c.query('SELECT count(*)::int AS n FROM app_user WHERE oidc_subject = $1', [subject]));
    expect(rows[0].n).toBe(1);
    expect(cookies.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('stores only a hash of the session cookie', async () => {
    const cookie = await loginAs(`hash-${randomUUID()}`);
    const value = cookie.split('=')[1]!;
    const { rows } = await withClient((c) => c.query('SELECT count(*)::int AS n FROM session WHERE id_hash = $1 OR id_hash = $2', [value, 'x']));
    expect(rows[0].n).toBe(0);
  });

  it('logout ends the session in the database', async () => {
    const cookie = await loginAs(`logout-${randomUUID()}`);
    expect((await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie, ...CSRF } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).statusCode).toBe(401);
  });
});

describe('person B against person A, on PostgreSQL', () => {
  const ID = () => randomUUID();
  const send = (cookie: string, method: 'PUT' | 'DELETE' | 'GET', id: string, payload?: object) =>
    app.inject({ method, url: `/api/v1/accounts/${id}`, headers: { cookie, ...(method === 'GET' ? {} : CSRF) }, payload });

  it('cannot read, list, edit or delete, and A keeps everything', async () => {
    const [alice, bob] = [await loginAs(`alice-${randomUUID()}`), await loginAs(`bob-${randomUUID()}`)];
    const id = ID();
    expect((await send(alice, 'PUT', id, { name: 'Alice private' })).statusCode).toBe(200);

    const read = await send(bob, 'GET', id);
    expect(read.statusCode).toBe(404);
    expect(read.body).not.toContain('Alice private');
    expect((await app.inject({ method: 'GET', url: '/api/v1/accounts', headers: { cookie: bob } })).json().items).toEqual([]);
    expect((await send(bob, 'PUT', id, { name: 'Hacked' })).statusCode).toBe(404);
    expect((await send(bob, 'DELETE', id)).statusCode).toBe(204);

    const mine = await send(alice, 'GET', id);
    expect(mine.statusCode).toBe(200);
    expect(mine.json().name).toBe('Alice private');
    const { rows } = await withClient((c) => c.query('SELECT name, deleted_at FROM account WHERE id = $1', [id]));
    expect(rows).toEqual([{ name: 'Alice private', deleted_at: null }]);
  });

  it('two people creating the same id at the same time: one wins, the other is told 404, nothing is mixed', async () => {
    const [alice, bob] = [await loginAs(`alice-${randomUUID()}`), await loginAs(`bob-${randomUUID()}`)];
    const id = ID();
    const [a, b] = await Promise.all([send(alice, 'PUT', id, { name: 'A' }), send(bob, 'PUT', id, { name: 'B' })]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 404]);
    const { rows } = await withClient((c) => c.query('SELECT count(*)::int AS n FROM account WHERE id = $1', [id]));
    expect(rows[0].n).toBe(1);
  });

  it('retrying the same create many times at once leaves one row (an offline device that retries)', async () => {
    const alice = await loginAs(`alice-${randomUUID()}`);
    const id = ID();
    const answers = await Promise.all(Array.from({ length: 10 }, () => send(alice, 'PUT', id, { name: 'Retry' })));
    expect(answers.every((r) => r.statusCode === 200)).toBe(true);
    const { rows } = await withClient((c) => c.query('SELECT count(*)::int AS n FROM account WHERE id = $1', [id]));
    expect(rows[0].n).toBe(1);
  });

  it('a delete wins over a late edit, and the row stays as a tombstone', async () => {
    const alice = await loginAs(`alice-${randomUUID()}`);
    const id = ID();
    await send(alice, 'PUT', id, { name: 'Gone' });
    expect((await send(alice, 'DELETE', id)).statusCode).toBe(204);
    expect((await send(alice, 'PUT', id, { name: 'Late' })).statusCode).toBe(410);
    expect((await send(alice, 'GET', id)).statusCode).toBe(404);
    const { rows } = await withClient((c) => c.query('SELECT name, deleted_at IS NOT NULL AS deleted FROM account WHERE id = $1', [id]));
    expect(rows).toEqual([{ name: 'Gone', deleted: true }]);
  });

  it('names with SQL, emoji and accents are stored as text', async () => {
    const alice = await loginAs(`alice-${randomUUID()}`);
    const id = ID();
    const name = "Robert'); DROP TABLE account;-- 💰 ação";
    expect((await send(alice, 'PUT', id, { name })).json().name).toBe(name);
    expect((await send(alice, 'GET', id)).json().name).toBe(name);
  });
});

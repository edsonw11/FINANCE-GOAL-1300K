import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/create-app';
import { CSRF } from '../support/http-app';
import { testConfig, withClient } from './support';

// The real identity provider (docker compose up -d keycloak): authorization code + PKCE, signature, nonce, issuer, all for real.
const config = testConfig();
let app: NestFastifyApplication;

const cleanup = () => withClient((c) => c.query('DELETE FROM app_user WHERE email IN ($1, $2)', ['alice@example.test', 'bob@example.test']));

beforeAll(async () => {
  const discovery = await fetch(`${config.oidc.issuer}/.well-known/openid-configuration`).catch(() => null);
  if (!discovery?.ok) throw new Error('Keycloak is not reachable: run `docker compose up -d keycloak` and wait for it to be healthy.');
  await cleanup();
  app = await createApp(config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterAll(async () => {
  await app?.close();
  await cleanup();
});

const cookiePairs = (headers: Headers | Record<string, unknown>): string[] => {
  const raw = headers instanceof Headers ? headers.getSetCookie() : ((headers['set-cookie'] as string[] | string | undefined) ?? []);
  return (Array.isArray(raw) ? raw : [raw]).map((c) => c.split(';')[0]!);
};

/** Does what a browser does: follows the redirect to Keycloak, fills the form, comes back. Returns the callback address and the API's login cookie. */
async function signInAtKeycloak(username: string, password: string, returnTo = '/') {
  const start = await app.inject({ method: 'GET', url: `/auth/login?returnTo=${encodeURIComponent(returnTo)}` });
  expect(start.statusCode).toBe(302);
  const flowCookie = cookiePairs(start.headers).find((c) => c.startsWith(`${config.cookies.flowName}=`))!;
  const authUrl = new URL(start.headers.location as string);
  expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
  expect(authUrl.searchParams.get('response_type')).toBe('code');

  const jar = new Map<string, string>();
  const keep = (h: Headers) => cookiePairs(h).forEach((c) => jar.set(c.split('=')[0]!, c));
  const page = await fetch(authUrl, { redirect: 'manual' });
  keep(page.headers);
  const html = await page.text();
  const action = /action="([^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, '&');
  if (!action) throw new Error(`no login form in the Keycloak page (status ${page.status})`);
  const submit = await fetch(action, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: [...jar.values()].join('; ') },
    body: new URLSearchParams({ username, password, credentialId: '' }),
  });
  return { flowCookie, submit };
}

describe('login with the real Keycloak', () => {
  it('logs alice in, creates her once, and sends her back where she was going', async () => {
    const { flowCookie, submit } = await signInAtKeycloak('alice', 'alice-dev-password', '/accounts');
    expect(submit.status).toBe(302);
    const back = new URL(submit.headers.get('location')!);
    expect(back.origin + back.pathname).toBe('http://localhost:3000/auth/callback');

    const callback = await app.inject({ method: 'GET', url: back.pathname + back.search, headers: { cookie: flowCookie } });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:3000/accounts');
    const session = cookiePairs(callback.headers).find((c) => c.startsWith(`${config.cookies.sessionName}=`))!;
    expect(session).toBeDefined();

    const me = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: session } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: 'alice@example.test', displayName: 'Alice Example' });

    // the callback cannot be played a second time
    const replay = await app.inject({ method: 'GET', url: back.pathname + back.search, headers: { cookie: flowCookie } });
    expect(replay.headers.location).toBe('http://localhost:3000/?login=failed');

    // logout gives the Keycloak address that ends its own session too
    const out = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: session, ...CSRF } });
    expect(out.json().endSessionUrl).toContain('/protocol/openid-connect/logout');
    expect((await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: session } })).statusCode).toBe(401);
  });

  it('alice and bob are different people and cannot see each other\'s data', async () => {
    const login = async (u: string, p: string) => {
      const { flowCookie, submit } = await signInAtKeycloak(u, p);
      const back = new URL(submit.headers.get('location')!);
      const cb = await app.inject({ method: 'GET', url: back.pathname + back.search, headers: { cookie: flowCookie } });
      return cookiePairs(cb.headers).find((c) => c.startsWith(`${config.cookies.sessionName}=`))!;
    };
    const [alice, bob] = [await login('alice', 'alice-dev-password'), await login('bob', 'bob-dev-password')];
    const id = '0190a1b2-0000-7000-8000-00000000abcd';
    expect((await app.inject({ method: 'PUT', url: `/api/v1/accounts/${id}`, headers: { cookie: alice, ...CSRF }, payload: { name: 'Alice only' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/v1/accounts/${id}`, headers: { cookie: bob } })).statusCode).toBe(404);
    await withClient((c) => c.query('DELETE FROM record WHERE id = $1', [id]));
  });

  it('a wrong password never reaches the API (Keycloak keeps the person on its own page)', async () => {
    const { submit } = await signInAtKeycloak('alice', 'wrong-password');
    expect(submit.status).toBe(200);
    expect(submit.headers.get('location')).toBeNull();
  });

  it('a callback with a forged code fails safely', async () => {
    const start = await app.inject({ method: 'GET', url: '/auth/login' });
    const flowCookie = cookiePairs(start.headers).find((c) => c.startsWith(`${config.cookies.flowName}=`))!;
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    const res = await app.inject({ method: 'GET', url: `/auth/callback?code=forged&state=${encodeURIComponent(state)}`, headers: { cookie: flowCookie } });
    expect(res.headers.location).toBe('http://localhost:3000/?login=failed');
  });
});

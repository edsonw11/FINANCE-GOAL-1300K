import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../../../src/auth/opaque-token';
import { CSRF, ORIGIN, type TestApp, createTestApp } from '../../support/http-app';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  t.provider.failBegin = null;
  t.provider.endSession = 'http://idp.test/logout';
  t.provider.failEndSession = false;
});

const setCookies = (headers: Record<string, unknown>): string[] => {
  const v = headers['set-cookie'];
  return Array.isArray(v) ? (v as string[]) : v ? [v as string] : [];
};
const cookieLine = (headers: Record<string, unknown>, name: string) => setCookies(headers).find((c) => c.startsWith(`${name}=`));

describe('GET /auth/login', () => {
  it('redirects to the identity provider and sets the short login cookie', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/auth/login' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(t.provider.requests.at(-1)!.url);
    const line = cookieLine(res.headers, t.config.cookies.flowName)!;
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Path=\//);
    expect(line).toMatch(/Expires=/i);
  });

  it('is public (no login needed) and never cached', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/auth/login' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('answers 503, without leaking the reason, when the identity provider is down', async () => {
    t.provider.failBegin = new Error('connect ECONNREFUSED keycloak:8080 secret-detail');
    const res = await t.app.inject({ method: 'GET', url: '/auth/login' });
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain('ECONNREFUSED');
    expect(res.body).not.toContain('secret-detail');
    expect(cookieLine(res.headers, t.config.cookies.flowName)).toBeUndefined();
  });

  it('ignores an array or object returnTo', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/auth/login?returnTo=/a&returnTo=/b' });
    expect(res.statusCode).toBe(302);
    const flow = [...t.flows.rows.values()].at(-1)!;
    expect(flow.returnTo).toBe('/');
  });
});

describe('GET /auth/callback', () => {
  const start = async (returnTo?: string) => {
    const res = await t.app.inject({ method: 'GET', url: `/auth/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}` });
    return cookieLine(res.headers, t.config.cookies.flowName)!.split(';')[0]!;
  };

  it('logs in: session cookie, flow cookie removed, back to the page asked for', async () => {
    const flow = await start('/accounts?tab=1');
    const res = await t.app.inject({ method: 'GET', url: t.provider.callbackFor(), headers: { cookie: flow } });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/accounts?tab=1`);
    const session = cookieLine(res.headers, t.config.cookies.sessionName)!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).toMatch(/Path=\//);
    expect(session).toMatch(/Expires=/i);
    expect(cookieLine(res.headers, t.config.cookies.flowName)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });

  it('puts only a hash of the session cookie in storage', async () => {
    const cookie = await t.login();
    const value = cookie.split('=')[1]!;
    expect(t.sessions.rows.has(hashToken(value))).toBe(true);
    expect(JSON.stringify([...t.sessions.rows.values()])).not.toContain(value);
  });

  it('an open redirect in returnTo ends on our own site', async () => {
    for (const evil of ['//evil.example', 'https://evil.example', '/\\evil.example', '/\t/evil.example']) {
      const flow = await start(evil);
      const res = await t.app.inject({ method: 'GET', url: t.provider.callbackFor(), headers: { cookie: flow } });
      expect(res.headers.location, evil).toBe(`${ORIGIN}/`);
    }
  });

  it('failure variants all redirect to /?login=failed, set no session, and tell nothing', async () => {
    const flow = await start();
    const cases: [string, string, Record<string, string>][] = [
      ['no cookie', t.provider.callbackFor(), {}],
      ['wrong state', '/auth/callback?code=c&state=forged', { cookie: flow }],
    ];
    for (const [label, url, headers] of cases) {
      const res = await t.app.inject({ method: 'GET', url, headers });
      expect(res.statusCode, label).toBe(302);
      expect(res.headers.location, label).toBe(`${ORIGIN}/?login=failed`);
      expect(cookieLine(res.headers, t.config.cookies.sessionName), label).toBeUndefined();
    }
  });

  it('the person denied access at the provider', async () => {
    const flow = await start();
    const res = await t.app.inject({ method: 'GET', url: t.provider.callbackFor('&error=access_denied'), headers: { cookie: flow } });
    expect(res.headers.location).toBe(`${ORIGIN}/?login=failed`);
  });

  it('the same return cannot be played twice', async () => {
    const flow = await start();
    const url = t.provider.callbackFor();
    const first = await t.app.inject({ method: 'GET', url, headers: { cookie: flow } });
    const second = await t.app.inject({ method: 'GET', url, headers: { cookie: flow } });
    expect(first.headers.location).toBe(`${ORIGIN}/`);
    expect(second.headers.location).toBe(`${ORIGIN}/?login=failed`);
  });

  it('a Host or forwarded header cannot change where the browser goes', async () => {
    const flow = await start('/ok');
    const res = await t.app.inject({
      method: 'GET',
      url: t.provider.callbackFor(),
      headers: { cookie: flow, host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' },
    });
    expect(res.headers.location).toBe(`${ORIGIN}/ok`);
    expect(t.provider.callbacks.at(-1)!.url.origin).toBe(ORIGIN);
  });

  it('logging in again ends the session that was still open in this browser', async () => {
    const old = await t.login();
    const flow = await start();
    await t.app.inject({ method: 'GET', url: t.provider.callbackFor(), headers: { cookie: `${flow}; ${old}` } });
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: old } });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/me', () => {
  it('is 401 without a session', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
  });

  it('answers who is logged in, and nothing else', async () => {
    const cookie = await t.login();
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['displayName', 'email', 'features', 'id', 'plan']);
    expect(res.json()).toMatchObject({ email: 'alice@example.test', displayName: 'Alice' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('401 and the dead cookie is removed when the session expired', async () => {
    const cookie = await t.login();
    t.clock.advance(t.config.session.ttlMs);
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    expect(res.statusCode).toBe(401);
    expect(cookieLine(res.headers, t.config.cookies.sessionName)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });

  it('401 for a forged cookie value', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: `${t.config.cookies.sessionName}=${'a'.repeat(43)}` } });
    expect(res.statusCode).toBe(401);
  });

  it('the user id in the session is not something the client can choose', async () => {
    const cookie = await t.login();
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie, 'x-user-id': 'someone-else' }, query: { userId: 'someone-else' } });
    expect(res.json().id).not.toBe('someone-else');
  });
});

describe('POST /auth/logout', () => {
  it('needs the CSRF protections like any change', async () => {
    const cookie = await t.login();
    expect((await t.app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie, origin: 'http://evil.example', 'x-everfox-csrf': '1' } })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie, origin: ORIGIN } })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).statusCode).toBe(200);
  });

  it('ends the session, clears the cookie and gives the provider logout address', async () => {
    const cookie = await t.login();
    const res = await t.app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie, ...CSRF } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ endSessionUrl: 'http://idp.test/logout' });
    expect(cookieLine(res.headers, t.config.cookies.sessionName)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('works without a session, and when the provider is down', async () => {
    t.provider.failEndSession = true;
    const res = await t.app.inject({ method: 'POST', url: '/auth/logout', headers: CSRF });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ endSessionUrl: null });
  });
});

describe('CSRF guard', () => {
  it.each([
    ['POST', '/auth/logout'],
    ['PUT', '/api/v1/accounts/0190a1b2-0000-7000-8000-000000000001'],
    ['DELETE', '/api/v1/accounts/0190a1b2-0000-7000-8000-000000000001'],
  ])('%s %s without Origin or header is refused before anything else', async (method, url) => {
    const res = await t.app.inject({ method: method as 'POST', url });
    expect(res.statusCode).toBe(403);
  });

  it('lowercase method names do not slip past', async () => {
    const res = await t.app.inject({ method: 'delete', url: '/api/v1/accounts/0190a1b2-0000-7000-8000-000000000001' });
    expect(res.statusCode).toBe(403);
  });

  it.each([
    ['another origin', { origin: 'http://evil.example', 'x-everfox-csrf': '1' }],
    ['origin with a path', { origin: `${ORIGIN}/`, 'x-everfox-csrf': '1' }],
    ['origin on another port', { origin: 'http://localhost:3001', 'x-everfox-csrf': '1' }],
    ['origin "null"', { origin: 'null', 'x-everfox-csrf': '1' }],
    ['no origin', { 'x-everfox-csrf': '1' }],
    ['wrong header value', { origin: ORIGIN, 'x-everfox-csrf': '0' }],
    ['empty header value', { origin: ORIGIN, 'x-everfox-csrf': '' }],
    ['no header', { origin: ORIGIN }],
  ])('refuses %s', async (_label, headers) => {
    const res = await t.app.inject({ method: 'POST', url: '/auth/logout', headers });
    expect(res.statusCode).toBe(403);
  });

  it('reads are not blocked by it', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/health/live' })).statusCode).toBe(200);
  });
});

describe('every route needs a login unless it is public', () => {
  it.each([
    ['GET', '/api/v1/me'],
    ['GET', '/api/v1/accounts'],
    ['GET', '/api/v1/accounts/0190a1b2-0000-7000-8000-000000000001'],
  ])('%s %s is 401 without a session', async (method, url) => {
    const res = await t.app.inject({ method: method as 'GET', url });
    expect(res.statusCode).toBe(401);
  });

  it('an unknown route does not reveal data and is 401 or 404, never 200', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect([401, 404]).toContain(res.statusCode);
  });

  it('health stays public', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/health/live' })).statusCode).toBe(200);
  });
});

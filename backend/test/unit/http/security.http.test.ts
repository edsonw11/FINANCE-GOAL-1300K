import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public } from '../../../src/auth/public.decorator';
import { baseHeaders, inlineScripts, pageCsp, scriptHash } from '../../../src/security/security-headers';
import { CSRF, type TestApp, createTestApp } from '../../support/http-app';

@Public()
@Controller('boom')
class BoomController {
  @Get()
  boom(): never {
    throw new Error('secret internal detail: password=hunter2 at /srv/app/secret.ts:12');
  }
}

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({ RATE_LIMIT_FACTOR: '1' }, [BoomController]);
});
afterAll(async () => t.close());
const get = (url: string, headers: Record<string, string> = {}) => t.app.inject({ method: 'GET', url, headers });

describe('security headers', () => {
  it.each(['/health/live', '/api/v1/me', '/auth/login', '/nothing-here'])('every answer carries the base set: %s', async (url) => {
    const res = await get(url);
    expect(res.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'same-origin',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'cache-control': 'no-store',
    });
    expect(String(res.headers['permissions-policy'])).toContain('camera=()');
  });

  it('data answers may load nothing and cannot be framed', async () => {
    expect((await get('/health/live')).headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  });

  it('there is no HSTS over plain http (it would lock a developer out of localhost)', async () => {
    expect((await get('/health/live')).headers['strict-transport-security']).toBeUndefined();
  });

  it('HSTS is added for production (HTTPS only)', () => {
    expect(baseHeaders(true)['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(baseHeaders(false)['strict-transport-security']).toBeUndefined();
  });

  it('the page has its own policy: own files, no plugins, no framing, no other form targets', async () => {
    const res = await get('/');
    const csp = String(res.headers['content-security-policy']);
    for (const part of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "connect-src 'self'"]) expect(csp).toContain(part);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp).not.toMatch(/script-src[^;]*\*/);
  });

  it('the page policy allows the inline script the page ships, by hash, and no other', async () => {
    const html = (await get('/')).body;
    const csp = String((await get('/')).headers['content-security-policy']);
    const scripts = inlineScripts(html);
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(csp).toContain(scriptHash(code));
    expect(csp.match(/sha256-/g)?.length).toBe(scripts.length);
  });
});

describe('the policy the browser tests run under is the one the API sends', () => {
  it('tests/page-csp.txt equals the real page policy (regenerate it from the running API if the page changes)', () => {
    const root = resolve(__dirname, '../../../..');
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(readFileSync(resolve(root, 'tests/page-csp.txt'), 'utf8').trim()).toBe(pageCsp(html));
  });
});

describe('pageCsp', () => {
  it('hashes inline scripts only, not scripts with a src, and not empty ones', () => {
    const html = '<script>alert(1)</script><script src="a.js"></script><script type="module" src="b.js"></script><script>  </script>';
    expect(inlineScripts(html)).toEqual(['alert(1)']);
    expect(pageCsp(html)).toContain(scriptHash('alert(1)'));
  });

  it('a page with no inline script allows only its own files', () => {
    expect(pageCsp('<script src="a.js"></script>')).toContain("script-src 'self';");
  });

  it('the hash is the standard base64 sha-256 of the exact text', () => {
    expect(scriptHash('')).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
  });
});

describe('CORS: the API answers its own page only', () => {
  it('gives no cross-origin permission to another site, with or without credentials', async () => {
    for (const url of ['/health/live', '/api/v1/me', '/api/v1/sync/changes?cursor=0']) {
      const res = await get(url, { origin: 'https://evil.example' });
      expect(res.headers['access-control-allow-origin'], url).toBeUndefined();
      expect(res.headers['access-control-allow-credentials'], url).toBeUndefined();
    }
  });

  it('a preflight from another site is not answered with permissions', async () => {
    const res = await t.app.inject({ method: 'OPTIONS', url: '/api/v1/sync/push', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-everfox-csrf' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBeUndefined();
  });

  it('a write from another site is refused even with a valid login (the cookie alone is not enough)', async () => {
    const cookie = await t.login();
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, origin: 'https://evil.example', 'x-everfox-csrf': '1' }, payload: { mutations: [] } });
    expect(res.statusCode).toBe(403);
  });
});

describe('errors never explain themselves', () => {
  it('an unexpected failure is a plain 500 with no message, stack, path or secret', async () => {
    const res = await get('/boom');
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toMatch(/hunter2|secret|\/srv\/|\.ts|at |stack/i);
    expect(Object.keys(res.json()).sort()).toEqual(['message', 'statusCode']);
  });

  it('a 404 and a 401 say nothing about what exists', async () => {
    expect((await get('/api/v1/accounts/' + randomUUID())).statusCode).toBe(401);
    expect(JSON.stringify((await get('/nothing')).json())).not.toMatch(/\.ts|stack/);
  });
});

describe('rate limits', () => {
  it('login: the 21st start in a minute from one address is refused with Retry-After, and a minute later it works again', async () => {
    t.clock.advance(60_001); // earlier tests used some of the allowance
    const results: number[] = [];
    for (let i = 0; i < 21; i++) results.push((await get('/auth/login')).statusCode);
    expect(results.slice(0, 20).every((c) => c === 302)).toBe(true);
    const refused = await get('/auth/login');
    expect(refused.statusCode).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(refused.json()).toMatchObject({ statusCode: 429, message: 'Too Many Requests' });
    t.clock.advance(60_001);
    expect((await get('/auth/login')).statusCode).toBe(302);
  });

  it('the callback shares the login allowance, so guessing codes is slowed too', async () => {
    t.clock.advance(60_001);
    for (let i = 0; i < 20; i++) await get('/auth/callback?code=x&state=y');
    expect((await get('/auth/login')).statusCode).toBe(429);
    t.clock.advance(60_001);
  });

  it('the push allowance is per person: one person at the limit does not slow another', async () => {
    t.clock.advance(3_600_001);
    const alice = await t.login();
    t.provider.identity = { ...t.provider.identity, subject: 'sub-other', email: 'other@example.test' };
    const other = await t.login();
    const push = (cookie: string) => t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF }, payload: { mutations: [{ mutationId: randomUUID(), resource: 'tx', op: 'delete', id: randomUUID() }] } });
    for (let i = 0; i < 120; i++) expect((await push(alice)).statusCode).toBe(200);
    expect((await push(alice)).statusCode).toBe(429);
    expect((await push(other)).statusCode).toBe(200);
    t.clock.advance(60_001);
    expect((await push(alice)).statusCode).toBe(200);
  });

  it('the same person from two addresses shares one allowance (a phone changing network keeps its count)', async () => {
    t.clock.advance(3_600_001);
    const cookie = await t.login();
    const push = (ip: string) => t.app.inject({ method: 'POST', url: '/api/v1/sync/push', remoteAddress: ip, headers: { cookie, ...CSRF }, payload: { mutations: [{ mutationId: randomUUID(), resource: 'tx', op: 'delete', id: randomUUID() }] } });
    for (let i = 0; i < 120; i++) await push(i % 2 ? '10.0.0.1' : '10.0.0.2');
    expect((await push('10.0.0.3')).statusCode).toBe(429);
    t.clock.advance(60_001);
  });

  it('import: a person gets six an hour', async () => {
    t.clock.advance(3_600_001);
    const cookie = await t.login();
    const imp = () => t.app.inject({ method: 'POST', url: '/api/v1/import/legacy-state?replace=true', headers: { cookie, ...CSRF, 'content-type': 'application/json' }, payload: '{"v":2,"tx":[]}' });
    for (let i = 0; i < 6; i++) expect((await imp()).statusCode).not.toBe(429);
    expect((await imp()).statusCode).toBe(429);
    t.clock.advance(3_600_001);
    expect((await imp()).statusCode).not.toBe(429);
  });

  it('requests without a login are counted too: a flood of wrong cookies is stopped', async () => {
    t.clock.advance(3_600_001);
    let last = 0;
    for (let i = 0; i < 1201; i++) last = (await get('/api/v1/me')).statusCode;
    expect(last).toBe(429);
    t.clock.advance(60_001);
    expect((await get('/api/v1/me')).statusCode).toBe(401);
  });

  // 2,600 requests: the default 5 s budget is too tight when the machine is busy (it timed out at a load average of 25 on 14 cores, and passes alone)
  it('the app files and the health checks are never counted', { timeout: 60_000 }, async () => {
    t.clock.advance(3_600_001);
    for (let i = 0; i < 1300; i++) expect((await get('/src/app.js')).statusCode).toBe(200);
    for (let i = 0; i < 1300; i++) expect((await get('/health/live')).statusCode).toBe(200);
    expect((await get('/index.html')).statusCode).toBe(200);
  });
});

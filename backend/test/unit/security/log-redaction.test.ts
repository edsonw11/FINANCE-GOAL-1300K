import { randomUUID } from 'node:crypto';
import { Logger, type LoggerService } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CSRF, type TestApp, createTestApp } from '../../support/http-app';

// Nothing a person or a login carries may reach the logs: session cookies, codes, the text of their records, their e-mail.
const lines: string[] = [];
const capture: LoggerService = {
  log: (...a) => void lines.push(a.join(' ')),
  warn: (...a) => void lines.push(a.join(' ')),
  error: (...a) => void lines.push(a.join(' ')),
  debug: (...a) => void lines.push(a.join(' ')),
  verbose: (...a) => void lines.push(a.join(' ')),
  fatal: (...a) => void lines.push(a.join(' ')),
};
let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  Logger.overrideLogger(capture);
});
afterAll(async () => {
  Logger.overrideLogger(false);
  await t.close();
});

const logged = () => lines.join('\n');

describe('what reaches the logs', () => {
  it('a login, its failure and the use of the session never write the cookie, the code or the e-mail', async () => {
    const cookie = await t.login();
    const sessionValue = cookie.split('=')[1]!;
    await t.app.inject({ method: 'GET', url: '/auth/callback?code=SECRET-CODE-123&state=wrong', headers: { cookie: 'everfox_flow=SECRET-FLOW' } });
    await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    const text = logged();
    for (const secret of [sessionValue, 'SECRET-CODE-123', 'SECRET-FLOW', t.provider.identity.email]) expect(text).not.toContain(secret);
  });

  it('the text of a record that is pushed, accepted or refused, is not logged', async () => {
    const cookie = await t.login();
    const body = { type: 'despesa', date: '2026-11-20', value: 1, cat: 'Mercado', desc: 'PRIVATE-DESCRIPTION-XYZ' };
    const good = { mutationId: randomUUID(), resource: 'tx', op: 'put', id: randomUUID(), data: { body, legacyKey: '1' } };
    const bad = { ...good, mutationId: randomUUID(), id: randomUUID(), data: { body: { ...body, date: 'PRIVATE-DESCRIPTION-XYZ' } } };
    await t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF }, payload: { mutations: [good, bad] } });
    await t.app.inject({ method: 'POST', url: '/api/v1/sync/push', headers: { cookie, ...CSRF, 'content-type': 'application/json' }, payload: '{"PRIVATE-DESCRIPTION-XYZ": ' });
    expect(logged()).not.toContain('PRIVATE-DESCRIPTION-XYZ');
  });

  it('a failure inside the server answers with a generic message, and the log has no cookie', async () => {
    const cookie = await t.login();
    const value = cookie.split('=')[1]!;
    const spy = vi.spyOn(t.users, 'findById').mockRejectedValue(new Error('connection to db.internal:5432 refused'));
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    spy.mockRestore();
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.body).not.toContain('db.internal');
    expect(res.body).not.toMatch(/stack|at \w+ \(/);
    expect(logged()).not.toContain(value);
  });
});

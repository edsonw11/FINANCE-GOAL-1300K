import { randomUUID } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { OIDC_PROVIDER } from '../../src/auth/oidc-provider';
import { configureApp, createAdapter } from '../../src/create-app';
import { RequiresFeature } from '../../src/plans/guards';
import { FakeOidcProvider } from '../support/fakes';
import { CSRF } from '../support/http-app';
import { testConfig, withClient } from './support';

@Controller('test-gated')
class GatedController {
  @Get('report')
  @RequiresFeature('report.monthly')
  report() {
    return { ok: true };
  }
}

// Plans, locked features and the admin routes on the real database.
const ISSUER = 'http://idp.test/plans';
let app: NestFastifyApplication;
const provider = new FakeOidcProvider();
const config = testConfig();
const cleanup = async () => {
  await withClient((c) => c.query("DELETE FROM plan_feature WHERE plan_id = 'free' AND feature_key = 'report.monthly'"));
  await withClient((c) => c.query("DELETE FROM audit_log WHERE action IN ('plan.feature.enable', 'plan.feature.disable', 'user.plan.set') AND actor_user_id IN (SELECT id FROM app_user WHERE oidc_issuer = $1)", [ISSUER]));
  await withClient((c) => c.query('DELETE FROM app_user WHERE oidc_issuer = $1', [ISSUER]));
};

beforeAll(async () => {
  await cleanup();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)], controllers: [GatedController] })
    .overrideProvider(OIDC_PROVIDER)
    .useValue(provider)
    .compile();
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
async function loginAs(subject: string): Promise<{ cookie: string; id: string }> {
  provider.identity = { issuer: ISSUER, subject, email: null, displayName: null };
  const start = await app.inject({ method: 'GET', url: '/auth/login' });
  const flow = cookieOf(start.headers, config.cookies.flowName)!;
  const back = await app.inject({ method: 'GET', url: provider.callbackFor(), headers: { cookie: flow } });
  const cookie = cookieOf(back.headers, config.cookies.sessionName)!;
  const id = (await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).json().id as string;
  return { cookie, id };
}
const gated = (cookie: string) => app.inject({ method: 'GET', url: '/test-gated/report', headers: { cookie } });
const admin = (cookie: string, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url: `/api/v1/admin${url}`, headers: { cookie, ...(method === 'GET' ? {} : CSRF) }, payload });

describe('plans on PostgreSQL', () => {
  it('a new person is on free with every feature locked; /me says so', async () => {
    const { cookie } = await loginAs(`p-${randomUUID()}`);
    const me = (await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).json();
    expect(me.plan).toEqual({ id: 'free', name: 'Free' });
    expect(Object.values(me.features).every((v) => v === false)).toBe(true);
    expect((await gated(cookie)).json()).toMatchObject({ code: 'feature_locked', feature: 'report.monthly' });
  });

  it('the whole admin cycle: a person is not an admin until an operator says so; changes take effect at once and are audited', async () => {
    const boss = await loginAs(`boss-${randomUUID()}`);
    const user = await loginAs(`user-${randomUUID()}`);
    expect((await admin(boss.cookie, 'GET', '/plans')).statusCode).toBe(403);
    await withClient((c) => c.query('UPDATE app_user SET is_admin = true WHERE id = $1', [boss.id]));
    expect((await admin(boss.cookie, 'GET', '/plans')).statusCode).toBe(200);

    expect((await admin(boss.cookie, 'PUT', '/plans/free/features/report.monthly')).json().changed).toBe(true);
    expect((await gated(user.cookie)).statusCode).toBe(200);
    expect((await admin(boss.cookie, 'PUT', '/plans/free/features/report.monthly')).json().changed).toBe(false);
    expect((await admin(boss.cookie, 'DELETE', '/plans/free/features/report.monthly')).json().changed).toBe(true);
    expect((await gated(user.cookie)).statusCode).toBe(403);

    expect((await admin(boss.cookie, 'PUT', `/users/${user.id}/plan`, { planId: 'pro' })).json()).toMatchObject({ planId: 'pro', changed: true });
    expect((await gated(user.cookie)).statusCode).toBe(200);
    expect((await admin(boss.cookie, 'PUT', `/users/${user.id}/plan`, { planId: 'free' })).json().changed).toBe(true);
    expect((await admin(boss.cookie, 'PUT', `/users/${randomUUID()}/plan`, { planId: 'pro' })).statusCode).toBe(404);

    const { rows } = await withClient((c) => c.query('SELECT action, target, details FROM audit_log WHERE actor_user_id = $1 ORDER BY id', [boss.id]));
    expect(rows.map((r) => r.action)).toEqual(['plan.feature.enable', 'plan.feature.disable', 'user.plan.set', 'user.plan.set']);
    expect(rows[2]).toMatchObject({ target: `user:${user.id}`, details: { planId: 'pro' } });

    await withClient((c) => c.query('UPDATE app_user SET is_admin = false WHERE id = $1', [boss.id]));
    expect((await admin(boss.cookie, 'GET', '/plans')).statusCode).toBe(403);
  });

  it('a person who is not an admin cannot change anything, and nothing is audited', async () => {
    const plain = await loginAs(`plain-${randomUUID()}`);
    expect((await admin(plain.cookie, 'PUT', '/plans/free/features/report.monthly')).statusCode).toBe(403);
    expect((await admin(plain.cookie, 'PUT', `/users/${plain.id}/plan`, { planId: 'pro' })).statusCode).toBe(403);
    const { rows } = await withClient((c) => c.query('SELECT plan_id FROM app_user WHERE id = $1', [plain.id]));
    expect(rows[0].plan_id).toBe('free');
    expect((await withClient((c) => c.query('SELECT 1 FROM audit_log WHERE actor_user_id = $1', [plain.id]))).rows).toHaveLength(0);
  });
});

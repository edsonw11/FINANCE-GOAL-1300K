import { Controller, Get } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FEATURES } from '../../../src/plans/features';
import { RequiresFeature } from '../../../src/plans/guards';
import { CSRF, type TestApp, createTestApp } from '../../support/http-app';

@Controller('test-gated')
class GatedController {
  @Get('report')
  @RequiresFeature('report.monthly')
  report() {
    return { ok: true };
  }
  @Get('open')
  open() {
    return { ok: true };
  }
}

let t: TestApp;
let alice: string;
let bob: string;
let aliceId: string;
let bobId: string;

const idOf = async (cookie: string) => (await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).json().id as string;
const me = async (cookie: string) => (await t.app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).json();
const gated = (cookie?: string) => t.app.inject({ method: 'GET', url: '/test-gated/report', headers: cookie ? { cookie } : {} });
const admin = (cookie: string, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: object, headers: Record<string, string> = {}) =>
  t.app.inject({ method, url: `/api/v1/admin${url}`, headers: { cookie, ...(method === 'GET' ? {} : CSRF), ...headers }, payload });

beforeAll(async () => {
  t = await createTestApp({}, [GatedController]);
  alice = await t.login();
  t.provider.identity = { ...t.provider.identity, subject: 'sub-bob', email: 'bob@example.test', displayName: 'Bob' };
  bob = await t.login();
  [aliceId, bobId] = [await idOf(alice), await idOf(bob)];
  t.plans.admins.add(aliceId); // made administrator outside the API, like an operator would
});
afterAll(async () => {
  await t.close();
});

describe('/api/v1/me tells the app what is locked', () => {
  it('a person on free sees the plan and every feature of the catalogue, all locked', async () => {
    const body = await me(bob);
    expect(body.plan).toEqual({ id: 'free', name: 'Free' });
    expect(Object.keys(body.features).sort()).toEqual([...FEATURES].sort());
    expect(Object.values(body.features).every((v) => v === false)).toBe(true);
  });

  it('does not tell a plain person whether they are an administrator, and never shows the plan table', async () => {
    const body = await me(bob);
    expect(JSON.stringify(body)).not.toMatch(/admin/i);
  });
});

describe('a locked route', () => {
  it('is 401 without a login, 403 feature_locked on free, and names the feature', async () => {
    expect((await gated()).statusCode).toBe(401);
    const locked = await gated(bob);
    expect(locked.statusCode).toBe(403);
    expect(locked.json()).toMatchObject({ code: 'feature_locked', feature: 'report.monthly' });
  });

  it('an unmarked route is open to everybody who is logged in', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/test-gated/open', headers: { cookie: bob } })).statusCode).toBe(200);
  });

  it('opens as soon as the person moves to pro, and locks again when they move back', async () => {
    t.plans.userPlans.set(bobId, 'pro');
    expect((await gated(bob)).statusCode).toBe(200);
    expect((await me(bob)).features['report.monthly']).toBe(true);
    t.plans.userPlans.set(bobId, 'free');
    expect((await gated(bob)).statusCode).toBe(403);
  });

  it('follows a change of the plan\'s own features at once, for everybody on it', async () => {
    t.plans.plans.get('free')!.features.add('report.monthly');
    expect((await gated(bob)).statusCode).toBe(200);
    t.plans.plans.get('free')!.features.delete('report.monthly');
    expect((await gated(bob)).statusCode).toBe(403);
  });

  it('ignores a feature in the database that the code does not know', async () => {
    t.plans.plans.get('free')!.features.add('from.the.future');
    const body = await me(bob);
    expect(Object.keys(body.features)).not.toContain('from.the.future');
    t.plans.plans.get('free')!.features.delete('from.the.future');
  });

  it('a client cannot claim a plan: headers, query and cookies change nothing', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/test-gated/report?plan=pro', headers: { cookie: bob, 'x-plan': 'pro', 'x-everfox-plan': 'pro' } });
    expect(res.statusCode).toBe(403);
  });
});

describe('admin routes', () => {
  it('are 401 without a login and 403 for a person who is not an administrator, for every route', async () => {
    const id = bobId;
    const calls: [string, string, object?][] = [
      ['GET', '/plans'],
      ['PUT', '/plans/free/features/report.monthly'],
      ['DELETE', '/plans/pro/features/report.monthly'],
      ['PUT', `/users/${id}/plan`, { planId: 'pro' }],
    ];
    for (const [method, url, payload] of calls) {
      const anon = await t.app.inject({ method: method as 'GET', url: `/api/v1/admin${url}`, headers: method === 'GET' ? {} : CSRF, payload });
      expect(anon.statusCode, `${method} ${url} anonymous`).toBe(401);
      const plain = await admin(bob, method as 'GET', url, payload);
      expect(plain.statusCode, `${method} ${url} plain person`).toBe(403);
    }
    expect(t.audit.entries).toEqual([]);
    expect(t.plans.plans.get('free')!.features.size).toBe(0);
    expect(t.plans.userPlans.get(bobId) ?? 'free').toBe('free');
  });

  it('a change from another origin or without the header is refused even for an administrator', async () => {
    expect((await admin(alice, 'PUT', '/plans/free/features/report.monthly', undefined, { origin: 'http://evil.example' })).statusCode).toBe(403);
    const noHeader = await t.app.inject({ method: 'PUT', url: '/api/v1/admin/plans/free/features/report.monthly', headers: { cookie: alice, origin: 'http://localhost:3000' } });
    expect(noHeader.statusCode).toBe(403);
    expect(t.plans.plans.get('free')!.features.size).toBe(0);
  });

  it('lists the plans', async () => {
    const res = await admin(alice, 'GET', '/plans');
    expect(res.statusCode).toBe(200);
    expect(res.json().plans.map((p: { id: string }) => p.id)).toEqual(['free', 'pro']);
  });

  it('turns a feature on for a plan: people on it get access, the change is audited once', async () => {
    const res = await admin(alice, 'PUT', '/plans/free/features/report.monthly');
    expect(res.json()).toEqual({ planId: 'free', feature: 'report.monthly', enabled: true, changed: true });
    expect((await gated(bob)).statusCode).toBe(200);
    expect(t.audit.entries).toHaveLength(1);
    expect(t.audit.entries[0]).toMatchObject({ actorUserId: aliceId, action: 'plan.feature.enable', target: 'plan:free', details: { feature: 'report.monthly' } });
  });

  it('turning it on again says unchanged and writes nothing more to the audit log', async () => {
    const res = await admin(alice, 'PUT', '/plans/free/features/report.monthly');
    expect(res.json()).toMatchObject({ enabled: true, changed: false });
    expect(t.audit.entries).toHaveLength(1);
  });

  it('turns it off again, audited, and the person is locked out on the next request', async () => {
    const res = await admin(alice, 'DELETE', '/plans/free/features/report.monthly');
    expect(res.json()).toEqual({ planId: 'free', feature: 'report.monthly', enabled: false, changed: true });
    expect((await gated(bob)).statusCode).toBe(403);
    expect(t.audit.entries.map((e) => e.action)).toEqual(['plan.feature.enable', 'plan.feature.disable']);
    expect((await admin(alice, 'DELETE', '/plans/free/features/report.monthly')).json().changed).toBe(false);
    expect(t.audit.entries).toHaveLength(2);
  });

  it('moves a person to a plan, audited', async () => {
    const res = await admin(alice, 'PUT', `/users/${bobId}/plan`, { planId: 'pro' });
    expect(res.json()).toEqual({ userId: bobId, planId: 'pro', changed: true });
    expect((await gated(bob)).statusCode).toBe(200);
    expect(t.audit.entries.at(-1)).toMatchObject({ action: 'user.plan.set', target: `user:${bobId}`, details: { planId: 'pro' } });
    await admin(alice, 'PUT', `/users/${bobId}/plan`, { planId: 'free' });
  });

  it('refuses what makes no sense, and changes nothing', async () => {
    const before = t.audit.entries.length;
    const cases: [string, 'PUT' | 'DELETE', string, object | undefined, number][] = [
      ['a feature the code does not know', 'PUT', '/plans/free/features/not.a.feature', undefined, 400],
      ['a feature key with odd characters', 'PUT', '/plans/free/features/' + encodeURIComponent("x'; DROP TABLE plan;--"), undefined, 400],
      ['a plan id with odd characters', 'PUT', '/plans/' + encodeURIComponent('Free Plan!') + '/features/report.monthly', undefined, 400],
      ['a plan that does not exist (enable)', 'PUT', '/plans/ghost/features/report.monthly', undefined, 404],
      ['a plan that does not exist (disable)', 'DELETE', '/plans/ghost/features/report.monthly', undefined, 404],
      ['moving to a plan that does not exist', 'PUT', `/users/${bobId}/plan`, { planId: 'ghost' }, 404],
      ['moving a person who does not exist', 'PUT', '/users/019f0000-0000-7000-8000-000000000000/plan', { planId: 'pro' }, 404],
      ['a user id that is not a uuid', 'PUT', '/users/nope/plan', { planId: 'pro' }, 400],
      ['no body', 'PUT', `/users/${bobId}/plan`, undefined, 400],
      ['an extra field in the body', 'PUT', `/users/${bobId}/plan`, { planId: 'pro', isAdmin: true }, 400],
      ['a plan id that is not text', 'PUT', `/users/${bobId}/plan`, { planId: 5 }, 400],
    ];
    t.plans.knownUsers.add(aliceId);
    t.plans.knownUsers.add(bobId);
    for (const [label, method, url, payload, status] of cases) {
      expect((await admin(alice, method, url, payload)).statusCode, label).toBe(status);
    }
    expect(t.audit.entries).toHaveLength(before);
    expect(t.plans.plans.has('ghost')).toBe(false);
  });

  it('there is no way to make somebody an administrator through the API', async () => {
    const res = await admin(alice, 'PUT', `/users/${bobId}/plan`, { planId: 'pro', isAdmin: true } as object);
    expect(res.statusCode).toBe(400);
    expect(t.plans.admins.has(bobId)).toBe(false);
  });

  it('taking the flag away stops the access on the very next request', async () => {
    expect((await admin(alice, 'GET', '/plans')).statusCode).toBe(200);
    t.plans.admins.delete(aliceId);
    expect((await admin(alice, 'GET', '/plans')).statusCode).toBe(403);
    t.plans.admins.add(aliceId);
  });

  it('answers are never cached', async () => {
    expect((await admin(alice, 'GET', '/plans')).headers['cache-control']).toBe('no-store');
  });
});

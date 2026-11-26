/**
 * specs/d05.mjs
 * Responsibility: diagram 05, sequence diagrams of the main communications with the API: login, sync, and the Pro monthly report.
 */
import { m, p } from './helpers.mjs';
const part = (id, title, kind, src, sym) => ({ ...p(id, title, kind), src, sym, status: 'IMPLEMENTED' });
export default {
  id: '05-sequence-diagrams',
  pages: [{
    name: 'Login', slug: 'login',
    title: 'Everfox: Sequence of Logging In (OpenID Connect)',
    subtitle: 'Code flow with a one-time login attempt tied to a short cookie; the session cookie holds a random value, the database only its hash.',
    participants: [
      part('br', 'Browser', 'api', 'src/sync/api-client.js', 'loginUrl'),
      part('ac', 'AuthController', 'api', 'backend/src/auth/auth.controller.ts', 'AuthController'),
      part('ls', 'LoginService', 'svc', 'backend/src/auth/login.service.ts', 'LoginService'),
      part('af', 'AuthFlowRepository', 'infra', 'backend/src/auth/auth-flow.repository.ts', 'AuthFlowRepository'),
      part('kc', 'Keycloak', 'ext', 'backend/src/auth/openid-client.provider.ts', 'OpenIdClientProvider'),
      part('ss', 'SessionService', 'svc', 'backend/src/auth/session.service.ts', 'SessionService'),
    ],
    messages: [
      m('br', 'ac', 'GET /auth/login?returnTo'),
      m('ac', 'ls', 'begin(returnTo)'),
      m('ls', 'kc', 'createAuthorizationRequest (state, nonce, PKCE verifier)', 'ext'),
      m('ls', 'af', 'insert the attempt (hashed id), delete expired'),
      m('ac', 'br', '302 to Keycloak, login cookie set', 'res'),
      m('br', 'kc', 'person signs in', 'ext'),
      m('br', 'ac', 'GET /auth/callback?code'),
      m('ac', 'ls', 'complete(cookie, callback url)'),
      m('ls', 'af', 'consume the attempt (once)'),
      m('ls', 'kc', 'completeLogin: exchange the code', 'ext'),
      m('ls', 'ss', 'create(userId): random token, store its hash'),
      m('ac', 'br', '302 to returnTo, session cookie set', 'res'),
      m('ac', 'br', 'LoginFailedError: login cookie cleared, redirect to the login-failed page, no session', 'err'),
    ],
    notes: ['Messages 6 and 10 are drawn as external calls. The last message shows the failure path (LoginFailedError).'],
  }, {
    name: 'Sync push and pull', slug: 'sync',
    title: 'Everfox: Sequence of a Sync Run',
    subtitle: 'Every request passes the global guards first. A mutation already seen gets its first answer again and changes nothing.',
    participants: [
      part('br', 'Browser sync runner', 'api', 'src/sync/runner.js', 'createSync'),
      part('gd', 'Global guards', 'api', 'backend/src/auth/csrf.guard.ts', 'CsrfGuard'),
      part('sc', 'SyncController', 'api', 'backend/src/sync/sync.controller.ts', 'SyncController'),
      part('sv', 'SyncService', 'svc', 'backend/src/sync/sync.service.ts', 'SyncService'),
      part('rs', 'SyncResource (per kind)', 'svc', 'backend/src/sync/sync-resource.ts', 'SyncResource'),
      part('db', 'PostgreSQL', 'infra', 'backend/src/database/prisma.service.ts', 'PrismaService'),
    ],
    messages: [
      m('br', 'gd', 'POST /api/v1/sync/push (cookie, origin, CSRF header)'),
      m('gd', 'sc', 'rate limit, CSRF, login ok'),
      m('sc', 'sv', 'push(userId, mutations)'),
      m('sv', 'db', 'find the mutation id in the log'),
      m('sv', 'rs', 'put / remove, if not seen'),
      m('rs', 'db', 'write the record with a new version'),
      m('sv', 'db', 'record the outcome'),
      m('sv', 'br', 'per mutation: applied, superseded, rejected or skipped', 'res'),
      m('br', 'sc', 'GET /api/v1/sync/changes?cursor'),
      m('sc', 'sv', 'changes(userId, cursor, limit)'),
      m('sv', 'rs', 'changesSince(version) of every resource'),
      m('sv', 'br', 'changes in version order, new cursor, hasMore', 'res'),
      m('gd', 'br', '401 login / 403 CSRF / 429 too many requests', 'err'),
    ],
  }, {
    name: 'Monthly report (Pro)', slug: 'report',
    title: 'Everfox: Sequence of the Monthly Report on the API',
    subtitle: 'The one route locked behind a plan feature (report.monthly). The rules are the same files the browser uses.',
    participants: [
      part('cl', 'Client', 'api', 'backend/src/legacy/months.controller.ts', 'MonthsController'),
      part('fg', 'FeatureGuard', 'api', 'backend/src/plans/guards.ts', 'FeatureGuard'),
      part('en', 'EntitlementsService', 'svc', 'backend/src/plans/entitlements.service.ts', 'EntitlementsService'),
      part('fr', 'FinanceRulesService', 'svc', 'backend/src/legacy/finance-rules.service.ts', 'FinanceRulesService'),
      part('ls', 'LegacyStateService', 'svc', 'backend/src/legacy/legacy-state.service.ts', 'LegacyStateService'),
      part('dr', 'Shared rules (buildReport)', 'dom', 'backend/src/domain/domain-runtime.ts', 'runWithState'),
    ],
    messages: [
      m('cl', 'fg', 'GET /api/v1/months/2026-11/report'),
      m('fg', 'en', 'has(userId, report.monthly)?'),
      m('en', 'fg', 'plan features read from the database', 'res'),
      m('fg', 'cl', '403 feature_locked (the app shows the PRO screen)', 'err'),
      m('cl', 'fr', 'compute(userId, fn)'),
      m('fr', 'ls', 'loadState(userId)'),
      m('fr', 'dr', 'runWithState(blank + stored state, buildReport(month))'),
      m('fr', 'cl', 'the report data (JSON), nothing saved', 'res'),
    ],
  }],
};

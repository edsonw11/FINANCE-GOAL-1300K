/**
 * specs/d02.mjs
 * Responsibility: diagram 02, the high-level architecture: clients, API modules, shared rules, data and identity, delivery.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '02-high-level-architecture',
  pages: [{
    title: 'Everfox: High-Level Architecture',
    subtitle: 'One code base for the rules (src/core and src/domain), used by the browser app and, on the server, by the API.',
    lanes: [
      lane('clients', 'Clients', 'api', [
        n('browser', 'Browser app', 'Plain ES modules (index.html + src/), or the single-file build in dist/. Keeps its data in the browser.', 'src/app.js', 'bindNavigation'),
        n('android', 'Android shell', 'Capacitor 8 around the same page, with its own CSP, offline, app lock.', 'android/app/src/main/java/com/everfox/app/MainActivity.java', 'MainActivity'),
      ], { col: 0, row: 0 }),
      lane('api', 'API (NestJS 12 on Fastify 5)', 'svc', [
        n('b-sec', 'Security layer', 'Rate limits, CSRF by origin, login check, plan and admin guards, security headers.', 'backend/src/security/security.module.ts', 'SecurityModule'),
        n('b-web', 'Web', 'Serves the browser app files (an allow-list of src/ and vendor/).', 'backend/src/web/web.module.ts', 'WebModule'),
        n('b-health', 'Health', 'Live and ready checks (ready asks the database).', 'backend/src/health/health.module.ts', 'HealthModule'),
        n('b-auth', 'Auth', 'OIDC login, cookie sessions, who am I.', 'backend/src/auth/auth.module.ts', 'AuthModule'),
        n('b-plans', 'Plans', 'Plan features per person and admin routes.', 'backend/src/plans/plans.module.ts', 'PlansModule'),
        n('b-acc', 'Accounts', 'Accounts of a person (REST).', 'backend/src/accounts/accounts.module.ts', 'AccountsModule'),
        n('b-sync', 'Sync', 'Push of offline changes, pull of changes after a cursor.', 'backend/src/sync/sync.module.ts', 'SyncModule'),
        n('b-rules', 'Month rules and import/export', 'Month summary, result and report computed by the shared rules; import and export of the whole state.', 'backend/src/legacy/legacy.module.ts', 'LegacyModule'),
      ], { col: 1, row: 0 }),
      lane('data', 'Data and identity', 'infra', [
        n('pg', 'PostgreSQL 18', 'Tables app_user, session, record, user_state, sync_*, plan, audit_log.', 'backend/src/database/prisma.service.ts', 'PrismaService'),
        n('kc', 'Keycloak 26', 'OpenID Connect identity provider (development realm in Docker Compose).', 'backend/src/auth/openid-client.provider.ts', 'OpenIdClientProvider', 'IMPLEMENTED', 'ext'),
      ], { col: 2, row: 0 }),
      lane('shared', 'Shared rules', 'dom', [
        n('rules', 'src/core + src/domain', 'The same plain JavaScript files, loaded by the API at start and run on one person\'s state.', 'backend/src/domain/domain-runtime.ts', 'loadDomain'),
      ], { col: 1, row: 1 }),
      lane('delivery', 'Build and delivery', 'infra', [
        n('ci', 'CI (GitHub Actions)', 'Jobs: check, backend, stack, android.', '.github/workflows/ci.yml', 'android:'),
        n('compose', 'Docker Compose', 'db, keycloak, migrate, api for the local full stack.', 'docker-compose.yml', 'keycloak:'),
        n('tg', 'APK to Telegram', 'Developer tool that sends the debug APK to a chat.', 'services/telegram-apk/send-apk.mjs', 'main'),
      ], { col: 0, row: 1 }),
    ],
    edges: [
      e('browser', 'b-web', 'GET page'),
      e('browser', 'b-auth', 'login'),
      e('browser', 'b-sync', 'push / changes'),
      e('b-auth', 'kc', 'OIDC', { kind: 'ext' }),
      e('b-sync', 'pg', 'Prisma'),
      e('b-rules', 'rules', 'loads at start'),
    ],
    notes: ['The Android shell makes no network calls (connect-src none): sync and login are not part of it yet. Only the browser app talks to the API.'],
  }],
};

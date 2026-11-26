/**
 * specs/d12.mjs
 * Responsibility: diagram 12, the endpoint map: every route of the API with its handler, its rule and its main errors.
 */
import { lane, n } from './helpers.mjs';
const r = (id, title, text, src, sym) => n(id, title, text, src, sym);
export default {
  id: '12-api-endpoints',
  pages: [{
    title: 'Everfox: API and Use Cases',
    subtitle: 'Every route except the ones marked public needs a login. Writes also need the app\'s origin and the CSRF header. Unless said otherwise the errors are 400 (input), 401, 403, 429.',
    lanes: [
      lane('pub', 'Pages, health and login', 'api', [
        r('ep-web', 'GET /, /index.html, /src/*, /vendor/*', 'Serves the browser app from an allow-list of files (public, no rate limit). 404 for anything else.', 'backend/src/web/web.controller.ts', 'WebController'),
        r('ep-live', 'GET /health/live', 'The process is up (public).', 'backend/src/health/health.controller.ts', 'live'),
        r('ep-ready', 'GET /health/ready', 'The database answers within the timeout (public). Not ready otherwise.', 'backend/src/health/health.controller.ts', 'ready'),
        r('ep-login', 'GET /auth/login?returnTo', 'Starts the OIDC login; 302 to the provider. Public, 20 per minute per address. 503 when the provider is unreachable.', 'backend/src/auth/auth.controller.ts', 'start'),
        r('ep-cb', 'GET /auth/callback', 'Finishes the login; session cookie; 302 to returnTo, or to the login-failed page. Public, 20 per minute per address.', 'backend/src/auth/auth.controller.ts', 'finish'),
        r('ep-out', 'POST /auth/logout', 'Ends the session; answers the provider\'s end-session address or null. Public.', 'backend/src/auth/auth.controller.ts', 'logout'),
        r('ep-me', 'GET /api/v1/me', 'Who is logged in, with the plan features (the app shows locked ones as PRO).', 'backend/src/auth/me.controller.ts', 'MeController'),
      ], { col: 0 }),
      lane('data', 'A person\'s data', 'svc', [
        r('ep-push', 'POST /api/v1/sync/push', 'Applies the outbox in order. Body: mutations (mutationId, resource, id, op, data). Answer: one result per mutation (applied, superseded, rejected, skipped). 120 per minute per person.', 'backend/src/sync/sync.controller.ts', 'push'),
        r('ep-chg', 'GET /api/v1/sync/changes', 'Changes after a cursor, in version order. Query: cursor, limit. Answer: changes, cursor, hasMore.', 'backend/src/sync/sync.controller.ts', 'changes'),
        r('ep-al', 'GET /api/v1/accounts', 'The person\'s accounts: { items }.', 'backend/src/accounts/accounts.controller.ts', 'list'),
        r('ep-ag', 'GET /api/v1/accounts/:id', 'One account. 404 when it is not found.', 'backend/src/accounts/accounts.controller.ts', 'get'),
        r('ep-ap', 'PUT /api/v1/accounts/:id', 'Creates or renames an account (idempotent). Body: name.', 'backend/src/accounts/accounts.controller.ts', 'save'),
        r('ep-ad', 'DELETE /api/v1/accounts/:id', 'Removes an account (204).', 'backend/src/accounts/accounts.controller.ts', 'remove'),
        r('ep-imp', 'POST /api/v1/import/legacy-state?replace', 'Imports a whole state (up to 25 MB). 6 per hour per person.', 'backend/src/legacy/legacy.controller.ts', 'importState'),
        r('ep-exp', 'GET /api/v1/export/legacy-state', 'Exports the whole state.', 'backend/src/legacy/legacy.controller.ts', 'exportState'),
      ], { col: 1 }),
      lane('rules', 'Month rules and admin', 'dom', [
        r('ep-sum', 'GET /api/v1/months/:month/summary', 'Month summary computed by the shared rules. :month is yyyy-mm.', 'backend/src/legacy/months.controller.ts', 'summary'),
        r('ep-res', 'GET /api/v1/months/:month/result', 'Month result: income, expenses, left, rate, level.', 'backend/src/legacy/months.controller.ts', 'result'),
        r('ep-rep', 'GET /api/v1/months/:month/report', 'Monthly report data. Needs plan feature report.monthly (403 feature_locked). Optional today=yyyy-mm-dd.', 'backend/src/legacy/months.controller.ts', 'report'),
        r('ep-apl', 'GET /api/v1/admin/plans', 'Plans and their features. Admin only.', 'backend/src/plans/admin.controller.ts', 'list'),
        r('ep-aen', 'PUT /api/v1/admin/plans/:planId/features/:key', 'Turns a feature on for a plan (key must be in the catalogue; 400 unknown_feature). Written to the audit log.', 'backend/src/plans/admin.controller.ts', 'enable'),
        r('ep-adi', 'DELETE /api/v1/admin/plans/:planId/features/:key', 'Turns a feature off. Audit logged.', 'backend/src/plans/admin.controller.ts', 'disable'),
        r('ep-aus', 'PUT /api/v1/admin/users/:userId/plan', 'Moves a person to a plan. 404 when the person is not found. Audit logged.', 'backend/src/plans/admin.controller.ts', 'setPlan'),
      ], { col: 2 }),
    ],
    edges: [],
    notes: ['The rows of this diagram are generated into analysis/api-catalog.md too. A route is never listed unless it is a decorated method of a controller.'],
  }],
};

/**
 * specs/d03.mjs
 * Responsibility: diagram 03, the internal components: the browser app by layer, and the API by module.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '03-internal-components',
  pages: [{
    name: 'Browser app', slug: 'frontend',
    title: 'Everfox: Components of the Browser App',
    subtitle: 'src/ in four layers. Core and domain never touch the page (checked by tests/unit/architecture.test.js); the screens call domain commands.',
    lanes: [
      lane('sync', 'Sync client (src/sync)', 'svc', [
        n('s-run', 'runner.js', 'One sync run: send the outbox, then pull changes.', 'src/sync/runner.js', 'createSync'),
        n('s-out', 'outbox.js', 'What waits to be sent; turns a changed state into entries.', 'src/sync/outbox.js', 'queueChanges'),
        n('s-rec', 'records.js', 'How the state splits into records, and the fingerprint of each.', 'src/sync/records.js', 'splitState'),
        n('s-app', 'apply.js', 'Puts pulled changes into the local state.', 'src/sync/apply.js', 'applyChanges'),
        n('s-api', 'api-client.js', 'The calls to the API; failures become offline, unauthorized or server.', 'src/sync/api-client.js', 'createApiClient'),
      ], { col: 0 }),
      lane('ui', 'Screens (src/ui)', 'api', [
        n('u-app', 'app.js', 'Starts everything in order and draws the first time.', 'src/app.js', 'bindNavigation'),
        n('u-nav', 'navigation and render', 'Tabs and the one render() that redraws the page.', 'src/ui/render.js', 'render'),
        n('u-views', 'views/', 'One module per screen or card (summary, list, card, goal, import, backup...).', 'src/ui/views/kpi.js', 'kpi'),
        n('u-comp', 'components/', 'Sheet, confirmation, money and date inputs, command runner.', 'src/ui/components/command.js', 'runCommand'),
        n('u-native', 'native-bridge and app-lock', 'Android only: share sheet, Back button, app lock.', 'src/ui/native-bridge.js', 'bindNativeBack'),
      ], { col: 1 }),
      lane('dom', 'Domain (src/domain)', 'dom', [
        n('d-store', 'store.js', 'The state S, its saving, transact(), withState().', 'src/domain/store.js', 'transact'),
        n('d-tx', 'Transactions', 'Create and edit a transaction; month queries.', 'src/domain/transaction-builder.js', 'saveTransaction'),
        n('d-month', 'Month numbers', 'Income, expenses, left, savings level.', 'src/domain/month-result.js', 'monthResult'),
        n('d-card', 'Credit card', 'Cycle, closing, due date, invoices, payment.', 'src/domain/card-cycle.js', 'dueMonth'),
        n('d-goal', 'Goal and wealth', 'Projection, real series, reserve, allocation.', 'src/domain/goal-projection.js', 'projectionPlan'),
        n('d-port', 'Portfolio', 'Positions with average cost from the trades.', 'src/domain/portfolio.js', 'positions'),
        n('d-imp', 'Import pipeline', 'Read OFX/CSV/PDF, classify, find duplicates, commit.', 'src/domain/import-commit.js', 'commitImport'),
        n('d-rep', 'Report', 'Every number of the monthly report.', 'src/domain/report.js', 'buildReport'),
        n('d-rec', 'State recovery', 'Unreadable data is kept aside; one copy per day.', 'src/domain/state-recovery.js', 'readState'),
      ], { col: 2 }),
      lane('core', 'Core (src/core)', 'infra', [
        n('c-money', 'money.js', 'Amounts as numbers rounded to cents.', 'src/core/money.js', 'roundMoney'),
        n('c-dates', 'dates.js', 'Dates and month keys (yyyy-mm).', 'src/core/dates.js', 'mKey'),
        n('c-fmt', 'format.js', 'Brazilian number format and parsing.', 'src/core/format.js', 'm2'),
        n('c-text', 'text-normalize.js', 'Lowercase, no accents, for matching descriptions.', 'src/core/text-normalize.js', 'normalizeText'),
        n('c-cfg', 'config.js', 'Constants: storage key, month names, default categories.', 'src/core/config.js', 'STORAGE_KEY'),
      ], { col: 3 }),
    ],
    edges: [
      e('s-run', 'u-app', 'bindSync wires it'),
      e('u-views', 'd-month', 'reads'),
      e('u-comp', 'd-store', 'transact'),
      e('d-month', 'c-money', 'uses'),
      e('d-card', 'c-dates', 'uses'),
    ],
  }, {
    name: 'API', slug: 'backend',
    title: 'Everfox: Components of the API',
    subtitle: 'backend/src: NestJS modules over ports (interfaces) with Prisma adapters. Controllers only translate HTTP; services hold the behaviour.',
    lanes: [
      lane('http', 'HTTP layer', 'api', [
        n('h-main', 'main.ts and create-app.ts', 'Builds the Fastify app, cookies, body limits, headers on every answer.', 'backend/src/create-app.ts', 'createApp'),
        n('h-guards', 'Global guards, in order', 'Address rate limit, CSRF, login check, person rate limit, admin, plan feature.', 'backend/src/auth/auth.module.ts', 'APP_GUARD'),
        n('h-input', 'Input checking', 'Every body and parameter is checked against a schema; 400 names the field.', 'backend/src/http/parse-input.ts', 'parseInput'),
      ], { col: 0 }),
      lane('mod', 'Feature modules', 'svc', [
        n('m-auth', 'Auth: LoginService, SessionService', 'Two-step OIDC login; opaque cookie sessions kept as a hash.', 'backend/src/auth/login.service.ts', 'LoginService'),
        n('m-sync', 'Sync: SyncService', 'Applies pushed mutations once, answers changes after a cursor.', 'backend/src/sync/sync.service.ts', 'SyncService'),
        n('m-acc', 'Accounts: AccountsService', 'Account rules over the record store.', 'backend/src/accounts/accounts.service.ts', 'AccountsService'),
        n('m-rules', 'Legacy: FinanceRulesService', 'Runs the shared rules on one person\'s stored state.', 'backend/src/legacy/finance-rules.service.ts', 'FinanceRulesService'),
        n('m-plans', 'Plans: EntitlementsService', 'Which features a person\'s plan has.', 'backend/src/plans/entitlements.service.ts', 'EntitlementsService'),
        n('m-health', 'Health: HealthService', 'Live always; ready when the database answers.', 'backend/src/health/health.service.ts', 'HealthService'),
      ], { col: 1 }),
      lane('port', 'Ports and adapters', 'infra', [
        n('p-rec', 'RecordStore', 'Records with versions, soft delete and a per-person change counter.', 'backend/src/records/record.store.ts', 'RecordStore'),
        n('p-sess', 'SessionRepository', 'Session rows (only the hash of the cookie value).', 'backend/src/auth/session.repository.ts', 'SessionRepository'),
        n('p-log', 'MutationLog', 'The answer to every mutation seen, so a retry changes nothing.', 'backend/src/sync/mutation-log.ts', 'MutationLog'),
        n('p-plan', 'PlanRepository', 'Plans and their features.', 'backend/src/plans/plan.repository.ts', 'PlanRepository'),
        n('p-prisma', 'PrismaService', 'The one database client (pool), connected on first use.', 'backend/src/database/prisma.service.ts', 'PrismaService'),
      ], { col: 2 }),
    ],
    edges: [
      e('h-guards', 'm-auth', 'every request'),
      e('m-sync', 'p-log', 'records outcome'),
      e('m-acc', 'p-rec', 'reads and writes'),
      e('m-auth', 'p-sess', 'sessions'),
      e('m-plans', 'p-plan', 'features'),
      e('m-health', 'p-prisma', 'ready check'),
    ],
  }],
};

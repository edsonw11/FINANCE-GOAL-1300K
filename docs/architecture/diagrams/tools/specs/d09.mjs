/**
 * specs/d09.mjs
 * Responsibility: diagram 09, the data model: the state kept on the device, and the tables of the database (the server stores no file).
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '09-data-model',
  pages: [{
    name: 'On the device', slug: 'device',
    title: 'Everfox: Data Kept on the Device',
    subtitle: 'No database in the browser: one JSON in localStorage (key metaapp.v2, version 2), plus small side keys.',
    lanes: [
      lane('state', 'State S (metaapp.v2)', 'dom', [
        n('m-root', 'Root', 'v (2), goal, rate, planned, nid (next id), ownNames, card settings.', 'src/domain/store.js', 'blankState'),
        n('m-acc', 'accounts', 'id, name, archived, reserve, kind; balances come from snaps.', 'src/domain/accounts.js', 'balance'),
        n('m-snap', 'snaps', 'date, acc, value, est: a dated balance of an account.', 'src/domain/store.js', 'snaps'),
        n('m-tx', 'tx', 'id, type (receita, despesa, aporte, fatura...), value, date, cat, fonte, desc, acc, splits, fm.', 'src/domain/transaction-builder.js', 'saveTransaction'),
        n('m-trade', 'trades', 'ticker, side (C or V), qty, price, fees, date, cls.', 'src/domain/portfolio.js', 'tradesOf'),
        n('m-xfer', 'transfers and imports', 'Own-account transfers kept apart, and the keys of imported items (to find duplicates).', 'src/domain/transfers.js', 'transfers'),
      ], { col: 0 }),
      lane('side', 'Side keys', 'infra', [
        n('k-bak', 'metaapp.v2.bak and .broken', 'The previous good copy (once a day), and the copy of data that could not be read.', 'src/domain/state-recovery.js', 'BACKUP_SUFFIX'),
        n('k-sync', 'Sync bookkeeping', 'cursor, outbox, review list, fingerprints, one key next to the state.', 'src/sync/outbox.js', 'emptyMeta'),
        n('k-lock', 'metaapp.lock', 'The app lock flag ("1" when on).', 'src/ui/app-lock/lock-policy.js', 'LOCK_KEY'),
        n('k-last', 'metaapp.lastBackup', 'When a backup last left the device.', 'src/ui/views/backup.js', 'LAST_BACKUP_KEY'),
      ], { col: 1 }),
    ],
    edges: [
      e('m-root', 'm-acc', 'has many'),
      e('m-acc', 'm-snap', 'has many'),
      e('m-root', 'k-bak', 'copy', { dashed: true }),
    ],
  }, {
    name: 'In PostgreSQL', slug: 'database',
    title: 'Everfox: Tables of the API Database',
    subtitle: 'backend/prisma/schema.prisma. A person\'s data is records of a kind with a version; ids are UUID v7 where the database creates them.',
    lanes: [
      lane('id', 'Identity and sessions', 'infra', [
        n('t-user', 'app_user', 'id, oidc_issuer + oidc_subject (unique), email, display_name, plan_id, is_admin, last_login_at.', 'backend/prisma/schema.prisma', 'model AppUser'),
        n('t-sess', 'session', 'id_hash (the cookie value is never stored), user_id, last_seen_at, expires_at.', 'backend/prisma/schema.prisma', 'model Session'),
        n('t-flow', 'auth_flow', 'One login attempt: state, nonce, code_verifier, return_to, expires_at.', 'backend/prisma/schema.prisma', 'model AuthFlow'),
      ], { col: 0 }),
      lane('data', 'A person\'s data', 'dom', [
        n('t-rec', 'record', 'id, user_id, kind (account, tx, snap, trade, transfer, import), position, body (JSON), version, deleted_at.', 'backend/prisma/schema.prisma', 'model Record'),
        n('t-state', 'user_state', 'The settings part of the state as one JSON, with a version.', 'backend/prisma/schema.prisma', 'model UserState'),
        n('t-cur', 'sync_cursor', 'last_version: the person\'s change counter.', 'backend/prisma/schema.prisma', 'model SyncCursor'),
        n('t-mut', 'sync_mutation', '(user_id, mutation_id) and its outcome: a retry gets the first answer.', 'backend/prisma/schema.prisma', 'model SyncMutation'),
      ], { col: 1 }),
      lane('plan', 'Plans', 'svc', [
        n('t-plan', 'plan', 'id, name.', 'backend/prisma/schema.prisma', 'model Plan'),
        n('t-feat', 'plan_feature', '(plan_id, feature_key): what each plan can use.', 'backend/prisma/schema.prisma', 'model PlanFeature'),
        n('t-audit', 'audit_log', 'actor, action, target, details of admin changes.', 'backend/prisma/schema.prisma', 'model AuditLog'),
      ], { col: 1, row: 1 }),
    ],
    edges: [
      e('t-user', 't-rec', 'owns'),
      e('t-user', 't-sess', 'has'),
      e('t-user', 't-plan', 'on a plan'),
      e('t-plan', 't-feat', 'has'),
    ],
    notes: ['Records use an index on (user_id, version) for the changes after a cursor. The API database role only reads and writes data; migrations run with another role (backend/prisma/roles/grants.sql).'],
  }],
};

/**
 * specs/d13.mjs
 * Responsibility: diagram 13, evolution: only after the current architecture. Each problem is something observed; each proposal is marked PROPOSAL and is not implemented.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '13-future-evolution',
  pages: [{
    title: 'Everfox: Architectural Evolution',
    subtitle: 'Current state first, then what limits it, then proposals. A PROPOSAL is not implemented.',
    lanes: [
      lane('now', 'Current architecture', 'dom', [
        n('v-now1', 'Rules shared by browser and API', 'One set of files runs in both places (ADR-0001, ADR-0006).', 'backend/src/domain/domain-runtime.ts', 'loadDomain'),
        n('v-now2', 'Offline-first sync', 'Outbox, cursor and idempotent mutations (ADR-0008, ADR-0010).', 'backend/src/sync/sync.service.ts', 'SyncService'),
        n('v-now3', 'Android shell', 'Same page in a WebView, offline, app lock (ADR-0014).', 'android/app/src/main/java/com/everfox/app/MainActivity.java', 'MainActivity'),
      ], { col: 0 }),
      lane('prob', 'Observed limits and risks', 'err', [
        n('v-p1', 'The API is not hosted', 'It only runs in Docker on a developer machine; the web app has no production address.', 'docker-compose.yml', 'api:'),
        n('v-p2', 'Android has no login or sync', 'The shell makes no network calls; the cookie login of the web app does not carry over to another origin.', 'src/ui/views/sync-view.js', 'bindSync'),
        n('v-p3', 'Rate limits are per instance', 'Counters live in memory; behind several instances the limits multiply.', 'backend/src/security/rate-limiter.ts', 'RateLimiter'),
        n('v-p4', 'Records are JSON bodies', 'Money and dates are not typed columns; SQL reports and constraints cannot use them.', 'backend/prisma/schema.prisma', 'model Record'),
        n('v-p5', 'Little to observe', 'Logs only; no metrics, traces or error reporting were found.', 'backend/src/logging/nest-log-levels.ts', 'nestLogLevels', 'NOT IDENTIFIED'),
        n('v-p6', 'No billing', 'Plans and feature locks exist; nothing charges or changes a plan by itself.', 'backend/src/plans/features.ts', 'FEATURES', 'PARTIAL'),
      ], { col: 1 }),
      lane('opp', 'Proposals', 'ext', [
        n('v-o1', 'Host the API and the web app', 'Run the container behind a proxy with trustProxy set on purpose (AWS, phases 9 and 10 of the plan).', 'docs/architecture/00-current-state.md', 'Phase', 'PROPOSAL'),
        n('v-o2', 'Phone sign-in for Android', 'System browser, app link and a token in the Android Keystore, with its own threat model.', 'docs/architecture/decisions/ADR-0014-android-shell.md', 'sign-in', 'PROPOSAL'),
        n('v-o3', 'Shared rate-limit store', 'Move the counters to a shared store when more than one instance runs.', 'backend/src/security/rate-limiter.ts', 'RateLimiter', 'PROPOSAL'),
        n('v-o4', 'Typed columns and command endpoints', 'Phase 4b-2: cents and dates as columns, endpoints that run one command each.', 'docs/architecture/00-current-state.md', '4b', 'PROPOSAL'),
        n('v-o5', 'Metrics and error reporting', 'Request counts and latency, errors with context, a dashboard.', 'backend/src/logging/nest-log-levels.ts', 'nestLogLevels', 'PROPOSAL'),
        n('v-o6', 'Billing', 'Web checkout and Play Billing mapped to plans (phase 8b).', 'docs/architecture/00-current-state.md', '8b', 'PROPOSAL'),
      ], { col: 2 }),
    ],
    edges: [
      e('v-p1', 'v-o1', 'addressed by', { dashed: true }),
      e('v-p2', 'v-o2', 'addressed by', { dashed: true }),
      e('v-p3', 'v-o3', 'addressed by', { dashed: true }),
      e('v-p4', 'v-o4', 'addressed by', { dashed: true }),
      e('v-p5', 'v-o5', 'addressed by', { dashed: true }),
      e('v-p6', 'v-o6', 'addressed by', { dashed: true }),
    ],
  }],
};

/**
 * specs/d10.mjs
 * Responsibility: diagram 10, error handling: what really happens on the device and on the API when something fails, and what has no special handling.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '10-error-handling',
  pages: [{
    title: 'Everfox: Error Handling',
    subtitle: 'Only behaviour found in the code. A failure with no entry here has no specific handling.',
    lanes: [
      lane('dev', 'On the device', 'err', [
        n('x-save', 'Saving fails (storage full, private mode)', 'transact() undoes the change and returns false; the person is told, nothing half-saved.', 'src/domain/store.js', 'transact'),
        n('x-read', 'Stored data cannot be read', 'It is copied to a .broken key, never overwritten; a blank state is used; a notice offers to restore yesterday\'s copy.', 'src/domain/state-recovery.js', 'readState'),
        n('x-imp', 'Import file too big, wrong type or unreadable', 'A plain message with the limit; photos and scans are refused; nothing is written.', 'src/domain/import-reader.js', 'IMPORT_LIMITS'),
        n('x-share', 'Backup cannot leave the phone', 'A cancelled share sheet is not an error and is not counted as a backup; a write failure is told and not counted.', 'src/ui/native-bridge.js', 'shareTextFile'),
        n('x-lock', 'Phone lost its screen lock', 'The app opens and switches its lock off with a message: no lock-out.', 'src/ui/app-lock/app-lock.js', 'createAppLock'),
      ], { col: 0 }),
      lane('sync', 'Sync (web app)', 'svc', [
        n('x-net', 'Offline, 401 or server error', 'The api client turns it into offline, unauthorized or server; the outbox stays as it is and the run stops.', 'src/sync/api-client.js', 'createApiClient'),
        n('x-rej', 'A mutation is rejected', 'unknown resource, invalid data or not found: it goes to the review list and the batch stops; later ones are skipped and sent again.', 'src/sync/runner.js', 'review'),
        n('x-none', 'Retries and back-off', 'No automatic retry loop or back-off timer was found: a run is started by the app, and a failed run leaves the outbox for the next one.', 'src/sync/runner.js', 'createSync', 'NOT IDENTIFIED'),
      ], { col: 1 }),
      lane('api', 'On the API', 'api', [
        n('x-400', '400 invalid input', 'Bodies and parameters are checked against a schema; the answer names the field and the kind of problem.', 'backend/src/http/parse-input.ts', 'parseInput'),
        n('x-401', '401 not logged in', 'Every route needs a login unless marked public; unknown, expired or idle sessions are refused (and idle ones deleted).', 'backend/src/auth/auth.guard.ts', 'AuthGuard'),
        n('x-403', '403 CSRF, locked feature, not admin', 'A write must come from the app\'s own origin with the CSRF header; a locked feature answers code feature_locked.', 'backend/src/auth/csrf.guard.ts', 'CsrfGuard'),
        n('x-429', '429 too many requests', 'Fixed-window counters in memory, by address and by person; the answer has retryAfterSeconds. Per instance: several instances count separately.', 'backend/src/security/rate-limit.guard.ts', 'RateLimit'),
        n('x-413', '413 body too large', '1 MB for every route, 25 MB for the whole-state import.', 'backend/src/create-app.ts', 'BODY_LIMIT_BYTES'),
        n('x-503', '503 login unavailable', 'The identity provider could not be reached to start a login.', 'backend/src/auth/auth.controller.ts', 'ServiceUnavailableException'),
      ], { col: 2 }),
      lane('ops', 'Operation', 'infra', [
        n('x-ready', 'Database not ready', '/health/ready answers not ready when the database does not answer within the timeout; /health/live stays up.', 'backend/src/health/health.service.ts', 'HealthService'),
        n('x-down', 'Shutdown', 'SIGTERM or SIGINT closes the server and the pool; after 10 s without finishing it exits with an error.', 'backend/src/shutdown.ts', 'DEFAULT_SHUTDOWN_TIMEOUT_MS'),
        n('x-log', 'Logs', 'Nest logger with a configurable level; the database URL is logged without its password.', 'backend/src/config/redact.ts', 'redact'),
      ], { col: 3 }),
    ],
    edges: [
      e('x-net', 'x-rej', 'if answered'),
    ],
  }],
};

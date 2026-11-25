#!/usr/bin/env bash
# One command for the security checks that need no running system:
#   1. secret scan of the tracked files
#   2. npm audit (production dependencies, both packages), failing on high or critical
#   3. the backend security suites (headers, CSP, rate limits, log redaction, sessions, IDOR/ownership, CSRF)
#   4. the XSS browser scenario (hostile text in every field, every screen) via scripts/smoke.sh
# Optional (needs a running API and Docker): ZAP=1 scripts/test-security.sh runs the OWASP ZAP baseline against http://localhost:3000.
# With a database up (`docker compose up -d db`): SECURITY_DB=1 also runs the backup/restore test and the data-only role tests.
set -uo pipefail
cd "$(dirname "$0")/.."
FAILED=0
step() { echo; echo "== $1"; shift; "$@" || { echo "FAILED: $*"; FAILED=1; }; }

step "secret scan" bash scripts/secret-scan.sh
step "npm audit, browser app (no runtime dependencies expected)" npm audit --omit=dev --audit-level=high
step "npm audit, backend" npm --prefix backend audit --omit=dev --audit-level=high
step "backend security suites" npm --prefix backend exec -- vitest run --root backend test/unit/security test/unit/http/security.http.test.ts test/unit/http/auth.http.test.ts test/unit/http/accounts.http.test.ts test/unit/auth
step "XSS and the rest of the browser scenarios" bash scripts/smoke.sh

if [ "${SECURITY_DB:-0}" = 1 ]; then
  step "backup and restore" bash scripts/backup-restore-test.sh
  step "data-only role" npm --prefix backend run test:integration -- test/integration/app-role.test.ts
fi
if [ "${ZAP:-0}" = 1 ]; then
  step "OWASP ZAP baseline (passive scan of the running API)" docker run --rm --network host -v "$(mktemp -d):/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://localhost:3000 -I
fi
echo
[ "$FAILED" = 0 ] && echo "SECURITY CHECKS OK" || { echo "SECURITY CHECKS FAILED"; exit 1; }

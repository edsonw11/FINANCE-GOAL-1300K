# Security test plan (Phase 7)

One command runs what needs no running system: `scripts/test-security.sh`. Options: `SECURITY_DB=1` (backup/restore and the data-only role, needs `docker compose up -d db`), `ZAP=1` (OWASP ZAP baseline against a running API).

| Area | What is checked | How | Where it runs |
|---|---|---|---|
| Secrets | no key, token or real-looking password is tracked; the scan itself catches a planted key | `scripts/secret-scan.sh` | CI (`check` job), `test-security.sh` |
| Dependencies | no high/critical advisory in production dependencies | `npm audit --omit=dev --audit-level=high` (both packages) | CI, `test-security.sh` |
| Authentication | PKCE/state, session hashing, expiry, logout, safe `returnTo` | unit + HTTP tests; real Keycloak in integration | CI |
| Authorisation (IDOR) | person B cannot read, list, edit or delete person A's data; races on the same id | `idor.test.ts` on PostgreSQL, HTTP tests with two people | CI |
| CSRF | unsafe methods without `Origin` + header are refused | `security.http.test.ts` | CI |
| Headers and CSP | `nosniff`, frame denial, referrer policy, HSTS in production, page CSP with script hashes; the browser tests run under that CSP | `security.http.test.ts`, `scripts/serve-csp.py` in smoke | CI |
| Rate limiting | limits per address and per person, `Retry-After`, window reset | `rate-limiter.test.ts`, `rate-limit.guard.test.ts` | CI |
| Input validation | bad shapes, NUL, depth, size, `__proto__`, foreign ids | `records-sync.http.test.ts`, `legacy.http.test.ts` | CI |
| XSS | hostile text in every free-text field, every main screen and sheet: nothing is created from text, nothing runs | `tests/smoke-xss.js` (headless Chrome, two loads) | CI (`npm run test:e2e`) |
| Database privileges | the API role can only read/write rows; no DDL, no `_prisma_migrations`, no other database | `app-role.test.ts` (27 tests) | CI |
| Logs | cookies, codes, e-mail and record text never reach the logs; 500s are generic | `log-redaction.test.ts` | CI |
| Backup | a dump restores into a scratch database and every table matches | `scripts/backup-restore-test.sh` | manual / `SECURITY_DB=1` |
| Container | read-only FS, no capabilities, `no-new-privileges` | `docker-compose.yml` (reviewed) | manual |
| Dynamic scan | passive OWASP ZAP baseline | `ZAP=1 scripts/test-security.sh` | before a public release |

Tests are only trusted when they can fail: each new security test above was checked with a deliberate break (a log line that prints the callback URL, the unescaped category in the list, a dump that loses data) and failed as it should.

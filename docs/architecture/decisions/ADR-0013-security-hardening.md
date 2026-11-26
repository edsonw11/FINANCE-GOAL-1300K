# ADR-0013: Security hardening (Phase 7)

Status: accepted. Context: the app is becoming a paid product that holds personal financial data (LGPD); Phases 3–5 gave login, ownership and sync.

## Decisions

1. **Headers and CSP from the API.** Base headers on every answer; the served page gets a CSP whose `script-src` lists the sha256 of each inline script (no `unsafe-inline` for scripts). Styles keep `'unsafe-inline'` (accepted, documented). HSTS only where cookies are `Secure` (production). The browser tests run under the same CSP (`scripts/serve-csp.py`), so a change that needs a looser policy fails CI.
2. **Rate limits in memory, per instance**, by address (default 1200/min, sign-in 20/min) and by person (push 120/min, import 6/hour). `RATE_LIMIT_FACTOR` only exists for tests; production forbids a value other than 1. A shared store is a Phase 9–10 item.
3. **Two database roles.** `everfox` owns the schema and runs migrations; `everfox_app` (SELECT/INSERT/UPDATE/DELETE, no `_prisma_migrations`, no DDL) is what the API uses. `prisma/roles/grants.sql` is re-applied after every migration (`npm run db:migrate`). Production refuses the development password of the role.
4. **XSS is tested in a browser, not guessed.** `tests/smoke-xss.js` fills every free-text field with markup that would run or build elements, opens every main screen and sheet, and fails if anything was created from text. First run found F-01.
5. **Backups are proven by restoring** (`scripts/backup-restore-test.sh`), not by dumping.
6. **One command** (`scripts/test-security.sh`) plus the CI steps for the secret scan and the audit; OWASP ZAP is optional and manual before the first public release.

## Consequences

- A new screen that draws user text must escape it; the XSS scenario only covers the screens it opens, so new sheets should be added to it.
- Operations must create the `everfox_app` role once per environment (`backend/scripts/db-app-role.sh`).
- Residual risks and findings: `docs/security/`.

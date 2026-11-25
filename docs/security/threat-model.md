# Threat model (Phase 7)

Scope: the browser app (`src/`), the API (`backend/`), the database and the way they are deployed with `docker-compose.yml` (the AWS reference comes in Phase 9–10).
Method: assets → entry points → threats (STRIDE) → what stops each one (and the test that proves it) → what is left.

## Assets

| Asset | Why it matters |
|---|---|
| A person's financial records (transactions, balances, goals, investments) | personal and sensitive data (LGPD); the product's whole value |
| Login sessions (cookie) | whoever has it is that person |
| Identity data (e-mail, name, OIDC subject) | personal data; links a person to their records |
| Plan / entitlement data | revenue: a locked PRO feature must stay locked |
| The database and its backups | everything above, in bulk |
| Secrets (OIDC client secret, database passwords) | each one opens one of the assets above |

## Trust boundaries and entry points

1. Browser ↔ API (`/api/v1/*`, `/auth/*`, the served app): the person is untrusted until a session proves who they are; even then, every body is untrusted.
2. API ↔ identity provider (Keycloak / any OIDC): trusted for who the person is, not for anything else.
3. API ↔ PostgreSQL: the API connects with a data-only role (Phase 7b).
4. Device storage (`localStorage`, outbox): readable by anything running in the page and by whoever holds the unlocked device.
5. Files the person imports (CSV, OFX, PDF, JSON backup): untrusted content that ends up in the page.

## Threats and mitigations (STRIDE)

| # | Threat | Mitigation | Proof |
|---|---|---|---|
| T1 | Spoofing: using someone else's session | opaque random session id; only its hash is stored; HttpOnly + SameSite=Lax, `Secure` in production; logout and expiry delete it | `auth/*` unit tests, `idor.test.ts` ("stores only a hash") |
| T2 | Spoofing: login CSRF / code injection into the OIDC flow | PKCE, `state`, one-time flow cookie, `returnTo` restricted to same-origin paths | `login.service.test.ts`, `return-to.test.ts` |
| T3 | Tampering: cross-site request making a change as the person | `Origin` check + custom header `x-everfox-csrf` on every unsafe method, SameSite cookie | `security.http.test.ts`, `auth.http.test.ts` |
| T4 | Information disclosure: person B reads or changes person A's data (IDOR/BOLA) | deny-by-default guard; every query is scoped by the session's person; ids of other people answer "not found" | `idor.test.ts` (real PostgreSQL), `records-sync.http.test.ts` |
| T5 | Injection: SQL | Prisma parameterised queries only; the API role cannot alter or drop tables | `idor.test.ts` ("names with SQL…"), `app-role.test.ts` |
| T6 | Injection: stored XSS through text the person (or an import, or another device) controls | text is escaped when drawn; CSP with hashes for inline scripts (no inline handlers exist in the app) | `tests/smoke-xss.js` (hostile text in every field, every screen), page-CSP browser runs |
| T7 | Denial of service: floods, huge bodies, deep JSON | rate limits (address and per person), 1 MB body limit (25 MB only for import), depth and size limits on records | `rate-limit.guard.test.ts`, `records-sync.http.test.ts` |
| T8 | Elevation: using a PRO feature without the plan | features checked on the server per request; the client only hides them | `plans.http.test.ts` |
| T9 | Elevation: a SQL injection or a bug becoming control of the database | split roles: the API cannot create, alter, drop or read migration data; PUBLIC lost CONNECT | `app-role.test.ts` (27 tests) |
| T10 | Repudiation / forensics | audit log of plan and security-relevant events | `plans.http.test.ts` |
| T11 | Disclosure through logs | logs carry reasons, not values; the database URL is redacted | `log-redaction.test.ts`, `redact.test.ts` |
| T12 | Secrets in the repository | `scripts/secret-scan.sh` (CI), production refuses development passwords | `load-config.test.ts`, the scan's own planted-key check |
| T13 | Data loss | backup/restore script that restores into a scratch database and compares every table | `scripts/backup-restore-test.sh` |
| T14 | Container breakout / tampering | API container: read-only filesystem, `cap_drop: ALL`, `no-new-privileges`, non-root | `docker-compose.yml` |
| T15 | Supply chain | `npm audit --audit-level=high` in CI for both packages; lock files committed | CI |

## Residual risks (known, accepted for now)

| # | Risk | Why it is accepted | When it ends |
|---|---|---|---|
| R1 | Rate limits live in the memory of one API instance | one instance today; counters are not shared | Phase 9–10: shared store (Redis/WAF) before a second instance |
| R2 | `style-src 'unsafe-inline'` in the CSP | the app sets inline `style=` attributes in many templates; scripts are the dangerous part and are locked | removing inline styles is a UI refactor, tracked as a finding (F-03) |
| R3 | Data in `localStorage` is readable by any script in the page and by whoever has the unlocked device | offline-first needs a local copy; XSS is the way to read it, hence T6 | Phase 8: Capacitor secure storage option |
| R4 | A person's own device can send any data it wants about that person | by design the server does not trust it for shape and size, only for ownership | n/a |
| R5 | The XSS browser scenario drives the main screens, not every sheet (import review, printable report) | those screens escape through the same helper; static scan found no gap | extend the scenario when those screens change |
| R6 | No brute-force lock-out of the identity provider account | the provider (Keycloak) owns it; the API rate-limits the sign-in route | production IdP settings in Phase 9–10 |
| R7 | The OWASP ZAP baseline is wired in `scripts/test-security.sh` but not run in CI | needs a running stack and a large image | run it before the first public release |

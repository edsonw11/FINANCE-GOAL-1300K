# ADR-0009 · Login, sessions and ownership (Phase 3)

Status: Accepted (2026-11-25). Implements [ADR-0003](ADR-0003-authentication-sso.md) for the web.

## Decisions
- **Authorization Code + PKCE (S256)** against Keycloak 26.8.2 (Cognito later). The API is a confidential client (BFF): tokens never reach the browser.
- **Session = a random 256-bit value in an HttpOnly, SameSite=Lax cookie.** Only its SHA-256 is stored, so a copy of the database cannot be used to log in.
  Absolute lifetime (default 7 days, never extended) and idle limit (default 3 days). `__Host-` Secure cookies in production.
- **A login attempt (state, nonce, PKCE verifier) lives in `auth_flow` for 10 minutes and is consumed by one `DELETE ... RETURNING`.** It can be used once,
  even by two parallel requests, and a failed try burns it.
- **A person is `(issuer, subject)`, never the e-mail.** Two people with the same e-mail stay two people.
- **Deny by default:** a global `AuthGuard` refuses every route that is not `@Public()`. A global `CsrfGuard` requires `Origin == APP_BASE_URL` and `x-everfox-csrf: 1` on anything that is not a read.
- **The callback address is built from `APP_BASE_URL`, never from `Host`/`X-Forwarded-*`.** `returnTo` accepts only a path of this site (rejects `//`, backslashes, control characters, dot segments that normalise to `//`).
- **Ownership:** every repository method takes the owner. Another person's id looks exactly like an id that does not exist (404 on read and write, 204 on delete).
  Ids come from the device (UUID) so an offline retry is safe ([ADR-0008](ADR-0008-offline-first-sync.md)); a delete leaves a tombstone and wins over a late edit (410).
- **Keycloak behind two names:** the browser uses `localhost:8081`, the API container uses `keycloak:8080` (`OIDC_INTERNAL_URL`); the issuer in the metadata must still equal `OIDC_ISSUER`.
- `Cache-Control: no-store` on every answer.

## How it is tested
Unit: services with a fake clock and fakes that pass the same contract suites as the PostgreSQL repositories; the whole HTTP application with in-memory storage.
Integration: the same contracts on PostgreSQL, database constraints, IDOR/BOLA and races on the real database, and a full login against a real Keycloak.
Mutation checks (a defect injected on purpose must fail a test) were run on both guards, return-to, session and flow expiry, and tenant scoping.

## Not done yet (on purpose)
Rate limiting on `/auth/login`, security headers/CSP, a restricted database role (Phase 7); account deletion endpoint; signed-in session list.

## Proposal, not decided: plans and locked features (PRO)
A catalogue of feature keys in code, a plan to feature table in the database, enforced in the API (403 `feature_locked`), returned by `/me` so the app can show a PRO badge.
Entitlements cached on the device and rechecked on sync. Managed by seed first, an admin area later, and by payment events in the billing phase. To be decided with the user in Phase 4.

# ADR-0003 · Authentication: OIDC (Authorization Code + PKCE), Keycloak locally

Status: Accepted (2026-11-24)

## Decision
- Standard **OpenID Connect**; public clients (web, app) use **Authorization Code + PKCE**; no client secret in any bundle.
- **Keycloak** in Docker for local development (realm and clients versioned, no production secrets). For AWS, **Cognito or a hosted Keycloak**,
  decided at deploy time; the backend only validates tokens (issuer, audience, signature, expiry), so the provider can change.
- **Web: BFF pattern** (the backend holds the tokens, the browser gets a `Secure; HttpOnly; SameSite` session cookie + CSRF token).
  **App:** system browser + deep link back, tokens in Keystore/Keychain through a maintained plugin.
- **Authorization:** the user id always comes from the validated session, never from the request; every query is scoped by it; IDOR/BOLA tests on every endpoint.
- Account deletion in app and web (LGPD and Play Store).

Alternatives: own login (rejected: never build an auth server), Firebase Auth (vendor lock, fine but no gain over OIDC).

/** What the API keeps while the user is at the identity provider, and compares when they come back. */
export interface FlowSecrets {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

export interface AuthorizationRequest extends FlowSecrets {
  /** Where to send the browser. */
  readonly url: string;
}

/** Who the identity provider says the person is. The pair (issuer, subject) is the identity; the rest is informative. */
export interface OidcIdentity {
  readonly issuer: string;
  readonly subject: string;
  readonly email: string | null;
  readonly displayName: string | null;
}

/** The login did not complete. `reason` is for the server log; it is never sent to the browser. */
export class LoginFailedError extends Error {
  constructor(
    readonly reason: string,
    options?: { cause?: unknown },
  ) {
    super(reason, options);
    this.name = 'LoginFailedError';
  }
}

/** The identity provider (Keycloak now, Cognito later) seen from the API: authorization code flow with PKCE. */
export interface OidcProvider {
  /** Fresh state, nonce and PKCE verifier, and the address to send the browser to. */
  createAuthorizationRequest(): Promise<AuthorizationRequest>;
  /**
   * Exchanges the code for tokens and checks everything (state, nonce, PKCE, signature, issuer, audience, expiry).
   * Throws LoginFailedError when anything is wrong.
   */
  completeLogin(callbackUrl: URL, expected: FlowSecrets): Promise<OidcIdentity>;
  /** Address that ends the provider's own session too, or null when it has none. */
  endSessionUrl(): Promise<string | null>;
}

export const OIDC_PROVIDER = Symbol('OIDC_PROVIDER');

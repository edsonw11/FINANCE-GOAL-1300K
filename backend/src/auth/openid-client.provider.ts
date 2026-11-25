import { Inject, Injectable } from '@nestjs/common';
import * as client from 'openid-client';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { type AuthorizationRequest, type FlowSecrets, LoginFailedError, type OidcIdentity, type OidcProvider } from './oidc-provider';

const DISCOVERY_TIMEOUT_MS = 5_000;
const HTTP_TIMEOUT_SECONDS = 8;
const SCOPE = 'openid email profile';
export const CALLBACK_PATH = '/auth/callback';

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

/** The identity provider through the `openid-client` library: authorization code flow with PKCE (S256), client secret on the server. */
@Injectable()
export class OpenIdClientProvider implements OidcProvider {
  private configuration: Promise<client.Configuration> | undefined;
  private readonly redirectUri: string;

  constructor(@Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'oidc' | 'appBaseUrl'>) {
    this.redirectUri = new URL(CALLBACK_PATH, config.appBaseUrl).href;
  }

  /** Fetched on first use, so the API starts when the provider is down; a failure is not remembered. */
  private load(): Promise<client.Configuration> {
    this.configuration ??= this.discover().catch((error: unknown) => {
      this.configuration = undefined;
      throw error;
    });
    return this.configuration;
  }

  private async discover(): Promise<client.Configuration> {
    const { issuer, internalUrl, clientId, clientSecret } = this.config.oidc;
    const base = (internalUrl ?? issuer).replace(/\/+$/, '');
    const response = await fetch(`${base}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`the provider metadata request answered ${response.status}`);
    const metadata = (await response.json()) as client.ServerMetadata;
    // the address may differ inside docker, but the tokens must still name the public issuer
    if (metadata.issuer !== issuer) throw new Error('the issuer in the provider metadata is not OIDC_ISSUER');
    const configuration = new client.Configuration(metadata, clientId, {}, client.ClientSecretBasic(clientSecret));
    configuration.timeout = HTTP_TIMEOUT_SECONDS;
    if (new URL(issuer).protocol === 'http:') client.allowInsecureRequests(configuration); // development only: production requires https
    return configuration;
  }

  async createAuthorizationRequest(): Promise<AuthorizationRequest> {
    const configuration = await this.load();
    const codeVerifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const url = client.buildAuthorizationUrl(configuration, {
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: SCOPE,
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { url: url.href, state, nonce, codeVerifier };
  }

  async completeLogin(callbackUrl: URL, expected: FlowSecrets): Promise<OidcIdentity> {
    const configuration = await this.load().catch((error: unknown) => {
      throw new LoginFailedError('the identity provider could not be reached', { cause: error });
    });
    try {
      const tokens = await client.authorizationCodeGrant(configuration, callbackUrl, {
        pkceCodeVerifier: expected.codeVerifier,
        expectedState: expected.state,
        expectedNonce: expected.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      const subject = text(claims?.sub);
      if (!claims || !subject) throw new LoginFailedError('the id token has no subject');
      if (claims.iss !== this.config.oidc.issuer) throw new LoginFailedError('the id token issuer is not the expected one');
      return {
        issuer: this.config.oidc.issuer,
        subject,
        email: text(claims.email),
        displayName: text(claims.name) ?? text(claims.preferred_username),
      };
    } catch (error) {
      if (error instanceof LoginFailedError) throw error;
      throw new LoginFailedError(error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error', { cause: error });
    }
  }

  async endSessionUrl(): Promise<string | null> {
    const configuration = await this.load();
    if (!configuration.serverMetadata().end_session_endpoint) return null;
    return client.buildEndSessionUrl(configuration, {
      client_id: this.config.oidc.clientId,
      post_logout_redirect_uri: new URL('/', this.config.appBaseUrl).href,
    }).href;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../clock';
import { USER_REPOSITORY, type UserRepository } from '../users/user.repository';
import { AUTH_FLOW_REPOSITORY, type AuthFlowRepository } from './auth-flow.repository';
import { LoginFailedError, OIDC_PROVIDER, type OidcProvider } from './oidc-provider';
import { hashToken, looksLikeToken, newOpaqueToken } from './opaque-token';
import { safeReturnTo } from './return-to';
import { SessionService } from './session.service';

/** How long a person has to finish logging in at the identity provider. */
export const LOGIN_FLOW_TTL_MS = 10 * 60 * 1000;

export interface BegunLogin {
  readonly authorizationUrl: string;
  /** For the login cookie: ties the return of the browser to this attempt. */
  readonly flowToken: string;
  readonly flowExpiresAt: Date;
}

export interface CompletedLogin {
  readonly sessionToken: string;
  readonly sessionExpiresAt: Date;
  readonly returnTo: string;
  readonly userId: string;
}

/** The two steps of logging in. No HTTP here: the controller handles cookies and redirects. */
@Injectable()
export class LoginService {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly provider: OidcProvider,
    @Inject(AUTH_FLOW_REPOSITORY) private readonly flows: AuthFlowRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly sessions: SessionService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async begin(returnTo: unknown): Promise<BegunLogin> {
    const now = this.clock.now();
    const request = await this.provider.createAuthorizationRequest();
    const flowToken = newOpaqueToken();
    const flowExpiresAt = new Date(now.getTime() + LOGIN_FLOW_TTL_MS);
    await this.flows.insert({
      idHash: hashToken(flowToken),
      state: request.state,
      nonce: request.nonce,
      codeVerifier: request.codeVerifier,
      returnTo: safeReturnTo(returnTo),
      createdAt: now,
      expiresAt: flowExpiresAt,
    });
    // attempts that were never finished must not pile up
    await this.flows.deleteExpired(now);
    return { authorizationUrl: request.url, flowToken, flowExpiresAt };
  }

  /** Address that ends the provider's own session too, or null when there is none or the provider cannot be reached (logging out must not fail for that). */
  async endSessionUrl(): Promise<string | null> {
    try {
      return await this.provider.endSessionUrl();
    } catch {
      return null;
    }
  }

  async complete(flowToken: unknown, callbackUrl: URL): Promise<CompletedLogin> {
    if (!looksLikeToken(flowToken)) throw new LoginFailedError('the login cookie is missing or malformed');
    // taken before anything else is checked: every attempt can be completed once, successful or not
    const flow = await this.flows.consume(hashToken(flowToken));
    if (!flow) throw new LoginFailedError('unknown or already used login attempt');
    const now = this.clock.now();
    if (flow.expiresAt.getTime() <= now.getTime()) throw new LoginFailedError('the login attempt expired');
    const identity = await this.provider.completeLogin(callbackUrl, flow);
    const user = await this.users.upsertFromIdentity(identity, now);
    const session = await this.sessions.create(user.id);
    return { sessionToken: session.token, sessionExpiresAt: session.expiresAt, returnTo: flow.returnTo, userId: user.id };
  }
}

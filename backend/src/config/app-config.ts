import { type LOG_LEVELS, type NODE_ENVS } from './env.schema';

export interface OidcConfig {
  /** The issuer as the tokens name it (what the browser is sent to). */
  readonly issuer: string;
  /** Where the API fetches the provider's metadata and keys from, when it is not `issuer` (null: same). */
  readonly internalUrl: string | null;
  readonly clientId: string;
  /** Never log it. */
  readonly clientSecret: string;
}

export interface SessionConfig {
  /** Absolute lifetime, from the login. */
  readonly ttlMs: number;
  /** How long a session may stay unused. */
  readonly idleMs: number;
}

export interface CookieConfig {
  /** Production only: the cookie is sent over HTTPS only, and takes the `__Host-` prefix. */
  readonly secure: boolean;
  readonly sessionName: string;
  readonly flowName: string;
}

/** The validated, read-only configuration of the API. Built once at startup by loadConfig. */
export interface AppConfig {
  readonly nodeEnv: (typeof NODE_ENVS)[number];
  readonly host: string;
  readonly port: number;
  readonly logLevel: (typeof LOG_LEVELS)[number];
  readonly healthCheckTimeoutMs: number;
  /** Contains the password: never log it, use redactUrl. */
  readonly databaseUrl: string;
  /** The origin the browser uses to reach the app, no trailing slash. */
  readonly appBaseUrl: string;
  readonly oidc: OidcConfig;
  readonly session: SessionConfig;
  readonly cookies: CookieConfig;
  /** 1 in production; larger only where people are not the ones asking (tests, local scripts). */
  readonly rateLimitFactor: number;
}

/** Injection token (an interface has no runtime value). */
export const APP_CONFIG = Symbol('APP_CONFIG');

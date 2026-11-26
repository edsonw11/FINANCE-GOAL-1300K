import { type AppConfig } from './app-config';
import { ConfigError, type ConfigIssue } from './config-error';
import { DEV_APP_DATABASE_PASSWORD, DEV_DATABASE_PASSWORD, DEV_OIDC_CLIENT_SECRET, type ParsedEnv, envSchema } from './env.schema';

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** The password of a connection URL as the database sees it: "%5F" is "_", so an encoded copy cannot slip past a comparison. */
function passwordOf(databaseUrl: string): string {
  const raw = new URL(databaseUrl).password;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // a stray "%" is not valid encoding: compare as written
  }
}

const isHttps = (url: string) => new URL(url).protocol === 'https:';

/** Rules that depend on more than one variable, or on the environment the API runs in. */
function crossIssues(v: ParsedEnv): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  // an idle limit longer than the absolute one would never apply
  if (v.SESSION_IDLE_MINUTES * MINUTE_MS > v.SESSION_TTL_HOURS * HOUR_MS) {
    issues.push({ variable: 'SESSION_IDLE_MINUTES', problem: 'must not be longer than SESSION_TTL_HOURS' });
  }
  if (v.NODE_ENV !== 'production') return issues;
  if (v.RATE_LIMIT_FACTOR !== 1) issues.push({ variable: 'RATE_LIMIT_FACTOR', problem: 'must be 1 in production (it loosens the request limits)' });
  if ([DEV_DATABASE_PASSWORD, DEV_APP_DATABASE_PASSWORD].includes(passwordOf(v.DATABASE_URL))) {
    issues.push({ variable: 'DATABASE_URL', problem: 'uses the local development password, which is not allowed in production' });
  }
  if (v.OIDC_CLIENT_SECRET === DEV_OIDC_CLIENT_SECRET) {
    issues.push({ variable: 'OIDC_CLIENT_SECRET', problem: 'is the local development secret, which is not allowed in production' });
  }
  if (!isHttps(v.APP_BASE_URL)) issues.push({ variable: 'APP_BASE_URL', problem: 'must use https:// in production' });
  if (!isHttps(v.OIDC_ISSUER)) issues.push({ variable: 'OIDC_ISSUER', problem: 'must use https:// in production' });
  return issues;
}

/**
 * Reads and validates the environment (pure: pass process.env, or any object in a test).
 * Throws ConfigError with every problem found; returns a frozen AppConfig otherwise.
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((i) => ({ variable: String(i.path[0] ?? 'environment'), problem: i.message })),
    );
  }
  const v = parsed.data;
  const issues = crossIssues(v);
  if (issues.length) throw new ConfigError(issues);
  const production = v.NODE_ENV === 'production';
  return Object.freeze({
    nodeEnv: v.NODE_ENV,
    host: v.HOST,
    port: v.PORT,
    logLevel: v.LOG_LEVEL,
    healthCheckTimeoutMs: v.HEALTH_CHECK_TIMEOUT_MS,
    databaseUrl: v.DATABASE_URL,
    appBaseUrl: new URL(v.APP_BASE_URL).origin,
    oidc: Object.freeze({
      issuer: v.OIDC_ISSUER,
      internalUrl: v.OIDC_INTERNAL_URL ?? null,
      clientId: v.OIDC_CLIENT_ID,
      clientSecret: v.OIDC_CLIENT_SECRET,
    }),
    rateLimitFactor: v.RATE_LIMIT_FACTOR,
    session: Object.freeze({ ttlMs: v.SESSION_TTL_HOURS * HOUR_MS, idleMs: v.SESSION_IDLE_MINUTES * MINUTE_MS }),
    // "__Host-" cookies must be Secure, so they only exist where HTTPS is guaranteed
    cookies: Object.freeze({
      secure: production,
      sessionName: production ? '__Host-everfox_session' : 'everfox_session',
      flowName: production ? '__Host-everfox_login' : 'everfox_login',
    }),
  });
}

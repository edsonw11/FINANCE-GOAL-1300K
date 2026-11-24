import { type AppConfig } from './app-config';
import { ConfigError, type ConfigIssue } from './config-error';
import { DEV_DATABASE_PASSWORD, envSchema } from './env.schema';

/** The password of a connection URL as the database sees it: "%5F" is "_", so an encoded copy cannot slip past a comparison. */
function passwordOf(databaseUrl: string): string {
  const raw = new URL(databaseUrl).password;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // a stray "%" is not valid encoding: compare as written
  }
}

/** Rules that depend on more than one variable, or on the environment the API runs in. */
function productionIssues(env: { nodeEnv: string; databaseUrl: string }): ConfigIssue[] {
  if (env.nodeEnv !== 'production') return [];
  const issues: ConfigIssue[] = [];
  if (passwordOf(env.databaseUrl) === DEV_DATABASE_PASSWORD) {
    issues.push({ variable: 'DATABASE_URL', problem: 'uses the local development password, which is not allowed in production' });
  }
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
  const prodIssues = productionIssues({ nodeEnv: v.NODE_ENV, databaseUrl: v.DATABASE_URL });
  if (prodIssues.length) throw new ConfigError(prodIssues);
  return Object.freeze({
    nodeEnv: v.NODE_ENV,
    host: v.HOST,
    port: v.PORT,
    logLevel: v.LOG_LEVEL,
    healthCheckTimeoutMs: v.HEALTH_CHECK_TIMEOUT_MS,
    databaseUrl: v.DATABASE_URL,
  });
}

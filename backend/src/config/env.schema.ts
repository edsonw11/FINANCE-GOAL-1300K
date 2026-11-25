import { z } from 'zod';

/** The password the local docker compose database starts with. It must never reach production. */
export const DEV_DATABASE_PASSWORD = 'everfox_dev_only';
/** The secret of the OIDC client in the local Keycloak realm file. It must never reach production. */
export const DEV_OIDC_CLIENT_SECRET = 'everfox-dev-client-secret';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const POSTGRES_URL = /^postgres(ql)?:\/\//i;
const MIN_CLIENT_SECRET_LENGTH = 16;

/** An integer written with digits only: "3000" yes, "3000.5", "3e3", " 3000", "0x10" and "" no. */
const digits = (min: number, max: number, what: string) =>
  z
    .string()
    .regex(/^\d+$/, `${what} must be a whole number`)
    .transform(Number)
    // no .int(): the digits-only pattern already guarantees it, and a second rule would report the same variable twice
    .pipe(z.number().min(min, `${what} must be at least ${min}`).max(max, `${what} must be at most ${max}`));

/** An http(s) URL with no credentials in it. `shape` adds the rule of what it points to. */
const httpUrl = (name: string, shape: (url: URL) => string | null) =>
  z.string({ error: `${name} is required` }).superRefine((value, ctx) => {
    if (!URL.canParse(value)) return void ctx.addIssue({ code: 'custom', message: `${name} is not a valid URL` });
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return void ctx.addIssue({ code: 'custom', message: `${name} must start with http:// or https://` });
    }
    if (url.username || url.password) return void ctx.addIssue({ code: 'custom', message: `${name} must not contain a user name or password` });
    const problem = shape(url);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** The environment variables the API understands (the contract of the container). Messages never include the received value. */
export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS, { error: `NODE_ENV must be one of: ${NODE_ENVS.join(', ')}` }).default('development'),
  HOST: z.string().min(1, 'HOST must not be empty').default('127.0.0.1'),
  PORT: digits(1, 65535, 'PORT').default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS, { error: `LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}` }).default('info'),
  HEALTH_CHECK_TIMEOUT_MS: digits(50, 30_000, 'HEALTH_CHECK_TIMEOUT_MS').default(2000),
  DATABASE_URL: z.string({ error: 'DATABASE_URL is required' }).superRefine((value, ctx) => {
    // one message per problem, so a wrong scheme is not also reported as "not a URL"
    if (!POSTGRES_URL.test(value)) ctx.addIssue({ code: 'custom', message: 'DATABASE_URL must start with postgresql:// or postgres://' });
    else if (!URL.canParse(value)) ctx.addIssue({ code: 'custom', message: 'DATABASE_URL is not a valid URL' });
  }),
  /** Where the browser reaches the app: an origin, like https://app.example.com. The login returns here. */
  APP_BASE_URL: httpUrl('APP_BASE_URL', (u) =>
    u.pathname !== '/' || u.search || u.hash ? 'APP_BASE_URL must be an origin only, like https://app.example.com (no path)' : null,
  ),
  /** The identity provider (Keycloak realm) as the browser and the tokens name it. */
  OIDC_ISSUER: httpUrl('OIDC_ISSUER', (u) => (u.search || u.hash ? 'OIDC_ISSUER must not have a query or a fragment' : null)),
  /** Where the API itself reaches the identity provider, when that is not the public address (docker network). */
  OIDC_INTERNAL_URL: httpUrl('OIDC_INTERNAL_URL', (u) => (u.search || u.hash ? 'OIDC_INTERNAL_URL must not have a query or a fragment' : null)).optional(),
  OIDC_CLIENT_ID: z.string({ error: 'OIDC_CLIENT_ID is required' }).min(1, 'OIDC_CLIENT_ID must not be empty'),
  OIDC_CLIENT_SECRET: z
    .string({ error: 'OIDC_CLIENT_SECRET is required' })
    .min(MIN_CLIENT_SECRET_LENGTH, `OIDC_CLIENT_SECRET must have at least ${MIN_CLIENT_SECRET_LENGTH} characters`),
  /** A session ends this long after the login, whatever happens. */
  SESSION_TTL_HOURS: digits(1, 24 * 90, 'SESSION_TTL_HOURS').default(168),
  /** A session ends after this long without a request. */
  SESSION_IDLE_MINUTES: digits(5, 60 * 24 * 30, 'SESSION_IDLE_MINUTES').default(4320),
  /** Multiplies every request allowance. For development and tests that log in or sync far more than a person does; production must leave it at 1. */
  RATE_LIMIT_FACTOR: digits(1, 100_000, 'RATE_LIMIT_FACTOR').default(1),
});

export type RawEnv = z.input<typeof envSchema>;
export type ParsedEnv = z.output<typeof envSchema>;

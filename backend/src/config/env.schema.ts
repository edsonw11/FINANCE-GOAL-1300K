import { z } from 'zod';

/** The password the local docker compose database starts with. It must never reach production. */
export const DEV_DATABASE_PASSWORD = 'everfox_dev_only';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const POSTGRES_URL = /^postgres(ql)?:\/\//i;

/** An integer written with digits only: "3000" yes, "3000.5", "3e3", " 3000", "0x10" and "" no. */
const digits = (min: number, max: number, what: string) =>
  z
    .string()
    .regex(/^\d+$/, `${what} must be a whole number`)
    .transform(Number)
    // no .int(): the digits-only pattern already guarantees it, and a second rule would report the same variable twice
    .pipe(z.number().min(min, `${what} must be at least ${min}`).max(max, `${what} must be at most ${max}`));

/**
 * The environment variables the API understands (the contract of the container).
 * Messages never include the received value: DATABASE_URL carries a password.
 */
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
});

export type RawEnv = z.input<typeof envSchema>;
export type ParsedEnv = z.output<typeof envSchema>;

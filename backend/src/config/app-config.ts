import { type LOG_LEVELS, type NODE_ENVS } from './env.schema';

/** The validated, read-only configuration of the API. Built once at startup by loadConfig. */
export interface AppConfig {
  readonly nodeEnv: (typeof NODE_ENVS)[number];
  readonly host: string;
  readonly port: number;
  readonly logLevel: (typeof LOG_LEVELS)[number];
  readonly healthCheckTimeoutMs: number;
  /** Contains the password: never log it, use redactUrl. */
  readonly databaseUrl: string;
}

/** Injection token (an interface has no runtime value). */
export const APP_CONFIG = Symbol('APP_CONFIG');

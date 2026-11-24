/** One thing the API depends on (the database, later a queue or the identity provider). It rejects when the thing is not usable. */
export interface HealthCheck {
  readonly name: string;
  run(): Promise<void>;
}

/** Injection token for the list of checks the readiness endpoint runs. */
export const HEALTH_CHECKS = Symbol('HEALTH_CHECKS');

export type CheckStatus = 'up' | 'down';

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly durationMs: number;
}

/** What the readiness endpoint returns. It never carries error text: that goes to the server log only. */
export interface HealthReport {
  readonly status: 'ok' | 'error';
  readonly checks: readonly CheckResult[];
}

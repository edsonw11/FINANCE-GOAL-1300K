import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { type CheckResult, HEALTH_CHECKS, type HealthCheck, type HealthReport } from './health-check';

/** Runs every health check at the same time, each with a time limit, and sums them up. */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(HEALTH_CHECKS) private readonly checks: readonly HealthCheck[],
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'healthCheckTimeoutMs'>,
  ) {}

  async readiness(): Promise<HealthReport> {
    const checks = await Promise.all(this.checks.map((c) => this.runOne(c)));
    return { status: checks.every((c) => c.status === 'up') ? 'ok' : 'error', checks };
  }

  private async runOne(check: HealthCheck): Promise<CheckResult> {
    const started = performance.now();
    let status: CheckResult['status'] = 'up';
    try {
      await this.withTimeout(check);
    } catch (error) {
      status = 'down';
      // the reason stays in the server log; the response only says "down"
      this.logger.warn(`Health check "${check.name}" failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { name: check.name, status, durationMs: Math.round(performance.now() - started) };
  }

  private async withTimeout(check: HealthCheck): Promise<void> {
    const limit = this.config.healthCheckTimeoutMs;
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${limit} ms`)), limit);
    });
    try {
      // an async wrapper also turns a synchronous throw of run() into a rejection
      await Promise.race([(async () => check.run())(), expired]);
    } finally {
      clearTimeout(timer);
    }
  }
}

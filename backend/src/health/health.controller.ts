import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { type HealthReport } from './health-check';
import { HealthService } from './health.service';

/** Unauthenticated (on purpose), outside /api/v1 and free of user data: for the load balancer and docker. */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** The process is up. Depends on nothing, so a database outage does not make the orchestrator kill the API. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** The API can serve requests: every dependency answers. 503 with the per-check summary otherwise. */
  @Get('ready')
  async ready(): Promise<HealthReport> {
    const report = await this.health.readiness();
    if (report.status === 'error') throw new ServiceUnavailableException(report);
    return report;
  }
}

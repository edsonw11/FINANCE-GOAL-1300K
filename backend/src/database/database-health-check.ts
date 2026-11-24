import { Inject, Injectable } from '@nestjs/common';
import { type HealthCheck } from '../health/health-check';
import { PrismaService } from './prisma.service';

/** Readiness of the database: it answers a trivial query. */
@Injectable()
export class DatabaseHealthCheck implements HealthCheck {
  readonly name = 'database';

  constructor(@Inject(PrismaService) private readonly database: Pick<PrismaService, 'ping'>) {}

  run(): Promise<void> {
    return this.database.ping();
  }
}

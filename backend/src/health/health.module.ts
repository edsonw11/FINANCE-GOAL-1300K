import { Module } from '@nestjs/common';
import { DatabaseHealthCheck } from '../database/database-health-check';
import { DatabaseModule } from '../database/database.module';
import { HEALTH_CHECKS, type HealthCheck } from './health-check';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    // one line per dependency the API needs to be ready
    { provide: HEALTH_CHECKS, useFactory: (database: DatabaseHealthCheck): HealthCheck[] => [database], inject: [DatabaseHealthCheck] },
  ],
})
export class HealthModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { AdminController } from './admin.controller';
import { AUDIT_REPOSITORY } from './audit.repository';
import { EntitlementsService } from './entitlements.service';
import { AdminGuard, FeatureGuard } from './guards';
import { PLAN_REPOSITORY } from './plan.repository';
import { PrismaAuditRepository } from './prisma-audit.repository';
import { PrismaPlanRepository } from './prisma-plan.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [
    EntitlementsService,
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
    { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
  exports: [EntitlementsService],
})
export class PlansModule {}

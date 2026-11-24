import { Module } from '@nestjs/common';
import { DatabaseHealthCheck } from './database-health-check';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService, DatabaseHealthCheck],
  exports: [PrismaService, DatabaseHealthCheck],
})
export class DatabaseModule {}

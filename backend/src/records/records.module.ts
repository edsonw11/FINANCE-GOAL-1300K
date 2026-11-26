import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaRecordStore } from './prisma-record.store';
import { RECORD_STORE } from './record.store';

/** Where a person's data lives. Other modules ask for RECORD_STORE; only this one knows it is PostgreSQL. */
@Module({
  imports: [DatabaseModule],
  providers: [{ provide: RECORD_STORE, useClass: PrismaRecordStore }],
  exports: [RECORD_STORE],
})
export class RecordsModule {}

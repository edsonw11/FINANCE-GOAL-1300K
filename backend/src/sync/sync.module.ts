import { Module } from '@nestjs/common';
import { accountSyncResource } from '../accounts/account-sync.resource';
import { DatabaseModule } from '../database/database.module';
import { isValidRecordBody } from '../legacy/legacy-state';
import { RecordSyncResource, StateSyncResource } from '../legacy/record-sync.resource';
import { RECORD_STORE, type RecordStore } from '../records/record.store';
import { RecordsModule } from '../records/records.module';
import { MUTATION_LOG } from './mutation-log';
import { PrismaMutationLog } from './prisma-mutation-log';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SYNC_RESOURCES } from './sync-resource';

@Module({
  imports: [DatabaseModule, RecordsModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    { provide: MUTATION_LOG, useClass: PrismaMutationLog },
    // one line per kind of record that syncs
    {
      provide: SYNC_RESOURCES,
      useFactory: (store: RecordStore) => [
        accountSyncResource(store),
        new RecordSyncResource('tx', store, (b) => isValidRecordBody('tx', b)),
        new RecordSyncResource('snap', store, (b) => isValidRecordBody('snap', b)),
        new RecordSyncResource('trade', store, (b) => isValidRecordBody('trade', b)),
        new RecordSyncResource('transfer', store, (b) => isValidRecordBody('transfer', b)),
        new RecordSyncResource('import', store, (b) => isValidRecordBody('import', b)),
        new StateSyncResource(store),
      ],
      inject: [RECORD_STORE],
    },
  ],
})
export class SyncModule {}

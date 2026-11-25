import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AccountSyncResource } from '../accounts/account-sync.resource';
import { DatabaseModule } from '../database/database.module';
import { RecordSyncResource, StateSyncResource } from '../legacy/record-sync.resource';
import { RECORD_STORE, type RecordStore } from '../records/record.store';
import { RecordsModule } from '../records/records.module';
import { MUTATION_LOG } from './mutation-log';
import { PrismaMutationLog } from './prisma-mutation-log';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SYNC_RESOURCES } from './sync-resource';

@Module({
  imports: [DatabaseModule, AccountsModule, RecordsModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    { provide: MUTATION_LOG, useClass: PrismaMutationLog },
    // one line per kind of record that syncs
    {
      provide: SYNC_RESOURCES,
      useFactory: (accounts: AccountSyncResource, store: RecordStore) => [
        accounts,
        new RecordSyncResource('tx', store, (b) => typeof b.type === 'string' && typeof b.date === 'string'),
        new RecordSyncResource('snap', store, (b) => typeof b.date === 'string' && b.acc !== undefined),
        new RecordSyncResource('trade', store, () => true),
        new RecordSyncResource('transfer', store, () => true),
        new RecordSyncResource('import', store, (b) => typeof b.hash === 'string'),
        new StateSyncResource(store),
      ],
      inject: [AccountSyncResource, RECORD_STORE],
    },
  ],
})
export class SyncModule {}

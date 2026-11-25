import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AccountSyncResource } from '../accounts/account-sync.resource';
import { DatabaseModule } from '../database/database.module';
import { MUTATION_LOG } from './mutation-log';
import { PrismaMutationLog } from './prisma-mutation-log';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SYNC_RESOURCES } from './sync-resource';

@Module({
  imports: [DatabaseModule, AccountsModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    { provide: MUTATION_LOG, useClass: PrismaMutationLog },
    // one line per kind of record that syncs
    { provide: SYNC_RESOURCES, useFactory: (accounts: AccountSyncResource) => [accounts], inject: [AccountSyncResource] },
  ],
})
export class SyncModule {}

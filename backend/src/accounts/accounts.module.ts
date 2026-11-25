import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { ACCOUNT_REPOSITORY } from './account.repository';
import { AccountSyncResource } from './account-sync.resource';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { RecordAccountRepository } from './record-account.repository';

@Module({
  imports: [RecordsModule],
  controllers: [AccountsController],
  exports: [AccountSyncResource],
  providers: [AccountsService, AccountSyncResource, { provide: ACCOUNT_REPOSITORY, useClass: RecordAccountRepository }],
})
export class AccountsModule {}

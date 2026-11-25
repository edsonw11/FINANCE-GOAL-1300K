import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ACCOUNT_REPOSITORY } from './account.repository';
import { AccountSyncResource } from './account-sync.resource';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PrismaAccountRepository } from './prisma-account.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AccountsController],
  exports: [AccountSyncResource],
  providers: [AccountsService, AccountSyncResource, { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository }],
})
export class AccountsModule {}

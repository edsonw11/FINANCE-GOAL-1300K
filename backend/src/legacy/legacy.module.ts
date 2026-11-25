import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { FinanceRulesService } from './finance-rules.service';
import { LegacyController } from './legacy.controller';
import { LegacyStateService } from './legacy-state.service';
import { MonthsController } from './months.controller';

@Module({
  imports: [RecordsModule],
  controllers: [LegacyController, MonthsController],
  providers: [LegacyStateService, FinanceRulesService],
})
export class LegacyModule {}

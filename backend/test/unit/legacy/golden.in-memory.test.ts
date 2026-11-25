import { randomUUID } from 'node:crypto';
import { FakeClock, InMemoryRecordStore } from '../../support/fakes';
import { goldenContract } from '../../contracts/golden.contract';
import { FinanceRulesService } from '../../../src/legacy/finance-rules.service';
import { LegacyStateService } from '../../../src/legacy/legacy-state.service';

goldenContract('in memory', async () => {
  const state = new LegacyStateService(new InMemoryRecordStore(), new FakeClock());
  return { state, rules: new FinanceRulesService(state), newUserId: async () => randomUUID() };
});

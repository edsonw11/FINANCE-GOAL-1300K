import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import { systemClock } from '../../src/clock';
import { PrismaService } from '../../src/database/prisma.service';
import { FinanceRulesService } from '../../src/legacy/finance-rules.service';
import { LegacyStateService } from '../../src/legacy/legacy-state.service';
import { PrismaRecordStore } from '../../src/records/prisma-record.store';
import { goldenContract } from '../contracts/golden.contract';
import { databaseUrl, withClient } from './support';

// The same acceptance as the unit one, on the real PostgreSQL: import, store, rebuild, calculate.
let prisma: PrismaService;
const ISSUER = 'http://idp.test/golden';
const cleanup = () => withClient((c) => c.query('DELETE FROM app_user WHERE oidc_issuer = $1', [ISSUER]));

beforeAll(async () => {
  prisma = new PrismaService({ databaseUrl: databaseUrl() });
  await cleanup();
});
afterAll(async () => {
  await cleanup();
  await prisma.onModuleDestroy();
});

goldenContract('PostgreSQL', async () => {
  const state = new LegacyStateService(new PrismaRecordStore(prisma), systemClock);
  return {
    state,
    rules: new FinanceRulesService(state),
    newUserId: async () => (await prisma.appUser.create({ data: { oidcIssuer: ISSUER, oidcSubject: randomUUID() } })).id,
  };
});

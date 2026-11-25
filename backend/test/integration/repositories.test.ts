import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import { PrismaAccountRepository } from '../../src/accounts/prisma-account.repository';
import { PrismaAuthFlowRepository } from '../../src/auth/prisma-auth-flow.repository';
import { PrismaSessionRepository } from '../../src/auth/prisma-session.repository';
import { PrismaService } from '../../src/database/prisma.service';
import { PrismaMutationLog } from '../../src/sync/prisma-mutation-log';
import { PrismaUserRepository } from '../../src/users/prisma-user.repository';
import { accountRepositoryContract } from '../contracts/account-repository.contract';
import { authFlowRepositoryContract } from '../contracts/auth-flow-repository.contract';
import { mutationLogContract } from '../contracts/mutation-log.contract';
import { sessionRepositoryContract } from '../contracts/session-repository.contract';
import { userRepositoryContract } from '../contracts/user-repository.contract';
import { databaseUrl, withClient } from './support';

// The same contracts the in-memory fakes pass, against the real PostgreSQL repositories.
let prisma: PrismaService;
const TEST_ISSUER = 'http://idp.test/integration';

const cleanup = () => withClient((c) => c.query("DELETE FROM app_user WHERE oidc_issuer LIKE 'http://idp.test%'"));

beforeAll(async () => {
  prisma = new PrismaService({ databaseUrl: databaseUrl() });
  await cleanup();
});
afterAll(async () => {
  await cleanup();
  await prisma.onModuleDestroy();
});

const newUserId = async (): Promise<string> =>
  (await prisma.appUser.create({ data: { oidcIssuer: TEST_ISSUER, oidcSubject: randomUUID() } })).id;

sessionRepositoryContract('PostgreSQL', async () => ({ repository: new PrismaSessionRepository(prisma), newUserId }));
authFlowRepositoryContract('PostgreSQL', async () => new PrismaAuthFlowRepository(prisma));
userRepositoryContract('PostgreSQL', async () => new PrismaUserRepository(prisma));
accountRepositoryContract('PostgreSQL', async () => ({ repository: new PrismaAccountRepository(prisma), newUserId }));
mutationLogContract('PostgreSQL', async () => ({ log: new PrismaMutationLog(prisma), newUserId }));

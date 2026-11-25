import { randomUUID } from 'node:crypto';
import { accountRepositoryContract } from '../contracts/account-repository.contract';
import { authFlowRepositoryContract } from '../contracts/auth-flow-repository.contract';
import { sessionRepositoryContract } from '../contracts/session-repository.contract';
import { userRepositoryContract } from '../contracts/user-repository.contract';
import { InMemoryAccountRepository, InMemoryAuthFlowRepository, InMemorySessionRepository, InMemoryUserRepository } from '../support/fakes';

// The fakes used by the other unit tests must obey the same rules as the real repositories: the same contract runs on both.
sessionRepositoryContract('in memory', async () => ({ repository: new InMemorySessionRepository(), newUserId: async () => randomUUID() }));
authFlowRepositoryContract('in memory', async () => new InMemoryAuthFlowRepository());
userRepositoryContract('in memory', async () => new InMemoryUserRepository());
accountRepositoryContract('in memory', async () => ({ repository: new InMemoryAccountRepository(), newUserId: async () => randomUUID() }));

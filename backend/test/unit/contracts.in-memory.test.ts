import { randomUUID } from 'node:crypto';
import { RecordAccountRepository } from '../../src/accounts/record-account.repository';
import { accountRepositoryContract } from '../contracts/account-repository.contract';
import { authFlowRepositoryContract } from '../contracts/auth-flow-repository.contract';
import { mutationLogContract } from '../contracts/mutation-log.contract';
import { planRepositoryContract } from '../contracts/plan-repository.contract';
import { recordStoreContract } from '../contracts/record-store.contract';
import { sessionRepositoryContract } from '../contracts/session-repository.contract';
import { userRepositoryContract } from '../contracts/user-repository.contract';
import { InMemoryAccountRepository, InMemoryAuthFlowRepository, InMemoryMutationLog, InMemoryPlanRepository, InMemoryRecordStore, InMemorySessionRepository, InMemoryUserRepository } from '../support/fakes';

// The fakes used by the other unit tests must obey the same rules as the real repositories: the same contract runs on both.
sessionRepositoryContract('in memory', async () => ({ repository: new InMemorySessionRepository(), newUserId: async () => randomUUID() }));
authFlowRepositoryContract('in memory', async () => new InMemoryAuthFlowRepository());
userRepositoryContract('in memory', async () => new InMemoryUserRepository());
accountRepositoryContract('in memory', async () => ({ repository: new InMemoryAccountRepository(), newUserId: async () => randomUUID() }));
accountRepositoryContract('over the in-memory record store', async () => ({ repository: new RecordAccountRepository(new InMemoryRecordStore()), newUserId: async () => randomUUID() }));
recordStoreContract('in memory', async () => ({ store: new InMemoryRecordStore(), newUserId: async () => randomUUID() }));
mutationLogContract('in memory', async () => ({ log: new InMemoryMutationLog(), newUserId: async () => randomUUID() }));
planRepositoryContract('in memory', async () => {
  const repository = new InMemoryPlanRepository();
  const known = repository.knownUsers;
  known.add(randomUUID()); // somebody exists, so unknown ids are really unknown
  return {
    repository,
    newUserId: async () => {
      const id = randomUUID();
      known.add(id);
      return id;
    },
    setAdmin: async (userId, isAdmin) => void (isAdmin ? repository.admins.add(userId) : repository.admins.delete(userId)),
  };
});

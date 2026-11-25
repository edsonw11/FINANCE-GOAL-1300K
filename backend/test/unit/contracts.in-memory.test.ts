import { randomUUID } from 'node:crypto';
import { accountRepositoryContract } from '../contracts/account-repository.contract';
import { authFlowRepositoryContract } from '../contracts/auth-flow-repository.contract';
import { mutationLogContract } from '../contracts/mutation-log.contract';
import { planRepositoryContract } from '../contracts/plan-repository.contract';
import { sessionRepositoryContract } from '../contracts/session-repository.contract';
import { userRepositoryContract } from '../contracts/user-repository.contract';
import { InMemoryAccountRepository, InMemoryAuthFlowRepository, InMemoryMutationLog, InMemoryPlanRepository, InMemorySessionRepository, InMemoryUserRepository } from '../support/fakes';

// The fakes used by the other unit tests must obey the same rules as the real repositories: the same contract runs on both.
sessionRepositoryContract('in memory', async () => ({ repository: new InMemorySessionRepository(), newUserId: async () => randomUUID() }));
authFlowRepositoryContract('in memory', async () => new InMemoryAuthFlowRepository());
userRepositoryContract('in memory', async () => new InMemoryUserRepository());
accountRepositoryContract('in memory', async () => ({ repository: new InMemoryAccountRepository(), newUserId: async () => randomUUID() }));
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

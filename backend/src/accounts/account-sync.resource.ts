import { Inject, Injectable } from '@nestjs/common';
import { type ApplyOutcome, type SyncChange, type SyncResource } from '../sync/sync-resource';
import { ACCOUNT_REPOSITORY, type AccountRepository } from './account.repository';
import { accountBodySchema } from './account.schemas';

/** Accounts as seen by the sync: the same rules and the same repository as the REST routes. */
@Injectable()
export class AccountSyncResource implements SyncResource {
  readonly name = 'account';

  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async put(userId: string, id: string, data: unknown, now: Date): Promise<ApplyOutcome> {
    const body = accountBodySchema.safeParse(data);
    if (!body.success) return { status: 'rejected', reason: 'invalid_data' };
    const result = await this.accounts.save(userId, id, body.data.name, now);
    if (result.status === 'taken') return { status: 'rejected', reason: 'not_found' };
    if (result.status === 'deleted') return { status: 'superseded', reason: 'deleted' };
    return { status: 'applied', version: result.account.version };
  }

  async remove(userId: string, id: string, now: Date): Promise<ApplyOutcome> {
    await this.accounts.remove(userId, id, now);
    return { status: 'applied', version: null };
  }

  async changesSince(userId: string, afterVersion: number, limit: number): Promise<SyncChange[]> {
    const changes = await this.accounts.changesSince(userId, afterVersion, limit);
    return changes.map((c) => ({
      resource: this.name,
      id: c.id,
      version: c.version,
      deleted: c.deleted,
      data: c.deleted ? null : { name: c.name, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() },
    }));
  }
}

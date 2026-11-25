import { Inject, Injectable } from '@nestjs/common';
import { RECORD_STORE, type RecordStore, type StoredRecord } from '../records/record.store';
import { type AccountChange, type AccountRecord, type AccountRepository, type SaveResult } from './account.repository';

const KIND = 'account';

const toRecord = (r: StoredRecord): AccountRecord => ({
  id: r.id,
  name: String(r.body.name ?? ''),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  version: r.version,
});

/** Accounts of the REST routes and of the sync, kept as records of kind "account" next to everything else the person has. */
@Injectable()
export class RecordAccountRepository implements AccountRepository {
  constructor(@Inject(RECORD_STORE) private readonly records: RecordStore) {}

  async list(userId: string): Promise<AccountRecord[]> {
    const all = (await this.records.list(userId, KIND)).map(toRecord);
    return all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }

  async find(userId: string, id: string): Promise<AccountRecord | null> {
    const found = await this.records.find(userId, KIND, id);
    return found ? toRecord(found) : null;
  }

  async save(userId: string, id: string, name: string, now: Date): Promise<SaveResult> {
    // merge: an account that came from the browser app has more fields than its name, and a rename must not lose them
    const result = await this.records.put(userId, KIND, id, { body: { name }, merge: true }, now);
    if (result.status === 'saved') return { status: 'saved', account: toRecord(result.record) };
    return result.status === 'deleted' ? { status: 'deleted' } : { status: 'taken' };
  }

  async remove(userId: string, id: string, now: Date): Promise<void> {
    await this.records.remove(userId, KIND, id, now);
  }

  async changesSince(userId: string, afterVersion: number, limit: number): Promise<AccountChange[]> {
    const changes = await this.records.changesSince(userId, KIND, afterVersion, limit);
    return changes.map((c) => ({ ...toRecord(c), deleted: c.deleted }));
  }
}

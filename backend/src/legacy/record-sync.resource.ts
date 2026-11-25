import { z } from 'zod';
import { type ApplyOutcome, type SyncChange, type SyncResource } from '../sync/sync-resource';
import { type Body, type RecordKind, type RecordStore } from '../records/record.store';
import { scanValue } from './legacy-state';

const dataSchema = z.strictObject({ body: z.record(z.string(), z.unknown()), legacyKey: z.string().min(1).max(200).nullable().optional() });

/** One kind of record (transactions, balances, ...) as the sync sees it. The body is the browser app's shape and is checked the same way as an import. */
export class RecordSyncResource implements SyncResource {
  readonly name: string;

  constructor(
    private readonly kind: RecordKind,
    private readonly store: RecordStore,
    private readonly check: (body: Body) => boolean,
  ) {
    this.name = kind;
  }

  async put(userId: string, id: string, data: unknown, now: Date): Promise<ApplyOutcome> {
    const parsed = dataSchema.safeParse(data);
    if (!parsed.success || scanValue(parsed.data.body, 5_000) !== null || !this.check(parsed.data.body)) return { status: 'rejected', reason: 'invalid_data' };
    const result = await this.store.put(userId, this.kind, id, { body: parsed.data.body, legacyKey: parsed.data.legacyKey }, now);
    switch (result.status) {
      case 'saved':
        return { status: 'applied', version: result.record.version };
      case 'deleted':
        return { status: 'superseded', reason: 'deleted' };
      default:
        // another person's id and a key already in use look the same from outside: the device must look at it
        return { status: 'rejected', reason: result.status === 'taken' ? 'not_found' : 'invalid_data' };
    }
  }

  async remove(userId: string, id: string, now: Date): Promise<ApplyOutcome> {
    await this.store.remove(userId, this.kind, id, now);
    return { status: 'applied', version: null };
  }

  async changesSince(userId: string, afterVersion: number, limit: number): Promise<SyncChange[]> {
    const changes = await this.store.changesSince(userId, this.kind, afterVersion, limit);
    return changes.map((c) => ({
      resource: this.name,
      id: c.id,
      version: c.version,
      deleted: c.deleted,
      data: c.deleted ? null : { body: c.body, legacyKey: c.legacyKey },
    }));
  }
}

/** The settings document as a synced record: its id is the person's id, so there is exactly one. The latest write wins as a whole. */
export class StateSyncResource implements SyncResource {
  readonly name = 'state';

  constructor(private readonly store: RecordStore) {}

  async put(userId: string, id: string, data: unknown, now: Date): Promise<ApplyOutcome> {
    if (id !== userId) return { status: 'rejected', reason: 'not_found' };
    const parsed = z.strictObject({ body: z.record(z.string(), z.unknown()) }).safeParse(data);
    if (!parsed.success || scanValue(parsed.data.body, 50_000) !== null) return { status: 'rejected', reason: 'invalid_data' };
    const saved = await this.store.putState(userId, parsed.data.body, now);
    return { status: 'applied', version: saved.version };
  }

  async remove(): Promise<ApplyOutcome> {
    // the settings are never deleted on their own: a person leaves by deleting the account
    return { status: 'rejected', reason: 'invalid_data' };
  }

  async changesSince(userId: string, afterVersion: number): Promise<SyncChange[]> {
    const state = await this.store.getState(userId);
    if (!state || state.version <= afterVersion) return [];
    return [{ resource: this.name, id: userId, version: state.version, deleted: false, data: { body: state.body } }];
  }
}

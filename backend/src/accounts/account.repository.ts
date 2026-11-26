export interface AccountRecord {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** The person's change counter when this record last changed (the cursor of the changes feed). */
  readonly version: number;
}

/** A line of the changes feed: a record that changed, or a tombstone (deleted) so the delete reaches every device. */
export interface AccountChange extends AccountRecord {
  readonly deleted: boolean;
}

/**
 * - saved: created, or changed. Saving what is already stored changes nothing, not even the version (a retry is free)
 * - taken: the id belongs to another person; nothing was touched and nothing about it is revealed
 * - deleted: the person's own record was deleted; a delete wins over a late create or edit (ADR-0008)
 */
export type SaveResult = { readonly status: 'saved'; readonly account: AccountRecord } | { readonly status: 'taken' } | { readonly status: 'deleted' };

/** Every method takes the owner. There is no way to ask for "account X" without saying whose it is. */
export interface AccountRepository {
  list(userId: string): Promise<AccountRecord[]>;
  find(userId: string, id: string): Promise<AccountRecord | null>;
  save(userId: string, id: string, name: string, now: Date): Promise<SaveResult>;
  /** Marks the person's own record as deleted (a new version). Unknown, another person's and already deleted ids do nothing. */
  remove(userId: string, id: string, now: Date): Promise<void>;
  /** The person's changes after this version, oldest first, tombstones included. */
  changesSince(userId: string, afterVersion: number, limit: number): Promise<AccountChange[]>;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

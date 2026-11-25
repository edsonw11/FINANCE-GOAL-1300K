/** The kinds of record a person has. The list is closed: a kind that is not here is refused before it reaches the database. */
export const RECORD_KINDS = ['account', 'tx', 'snap', 'trade', 'transfer', 'import'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
export const isRecordKind = (value: unknown): value is RecordKind => typeof value === 'string' && (RECORD_KINDS as readonly string[]).includes(value);

export type Body = Record<string, unknown>;

export interface StoredRecord {
  readonly id: string;
  readonly kind: RecordKind;
  /** The id the browser app gave it ('nu', 12, 't7') as text, when it came from there. */
  readonly legacyKey: string | null;
  /** The version at creation: the order of the list as the person made it. */
  readonly position: number;
  readonly body: Body;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
  readonly deleted: boolean;
}

export interface StoredState {
  readonly body: Body;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface PutInput {
  readonly body: Body;
  /** Only set when the record comes from the browser app. Left out, an existing key is kept. */
  readonly legacyKey?: string | null;
  /** Add these fields to the stored body instead of replacing it (the REST route of accounts only knows `name`). */
  readonly merge?: boolean;
}

/**
 * - saved: created, or changed. Saving what is already stored changes nothing, not even the version
 * - taken: the id belongs to another person (or to another kind); nothing was touched and nothing is revealed
 * - deleted: the person's own record was deleted; a delete wins over a late edit (ADR-0008)
 * - key_taken: another record of this person already has this legacy key
 */
export type PutResult =
  | { readonly status: 'saved'; readonly record: StoredRecord }
  | { readonly status: 'taken' }
  | { readonly status: 'deleted' }
  | { readonly status: 'key_taken' };

export interface ImportItem {
  readonly id: string;
  readonly kind: RecordKind;
  readonly legacyKey: string | null;
  readonly body: Body;
}

export type ImportResult = { readonly status: 'imported'; readonly records: number } | { readonly status: 'not_empty' };

/** Every method takes the owner. There is no way to ask for a record without saying whose it is. */
export interface RecordStore {
  put(userId: string, kind: RecordKind, id: string, input: PutInput, now: Date): Promise<PutResult>;
  /** Marks the person's own record as deleted (a new version). Unknown, another person's and already deleted ids do nothing. */
  remove(userId: string, kind: RecordKind, id: string, now: Date): Promise<void>;
  find(userId: string, kind: RecordKind, id: string): Promise<StoredRecord | null>;
  /** Live records of a kind, in the order they were made. */
  list(userId: string, kind: RecordKind): Promise<StoredRecord[]>;
  /** The person's changes of one kind after this version, oldest first, tombstones included. */
  changesSince(userId: string, kind: RecordKind, afterVersion: number, limit: number): Promise<StoredRecord[]>;
  getState(userId: string): Promise<StoredState | null>;
  /** Replaces the settings document. Saving what is already stored changes nothing. */
  putState(userId: string, body: Body, now: Date): Promise<StoredState>;
  /**
   * Loads a whole person's data in one transaction (the browser app's export). With `replace` the existing data is deleted first
   * (tombstones, so other devices learn it); without it, a person who already has data gets `not_empty` and nothing changes.
   */
  importAll(userId: string, items: readonly ImportItem[], state: Body, now: Date, replace: boolean): Promise<ImportResult>;
}

export const RECORD_STORE = Symbol('RECORD_STORE');

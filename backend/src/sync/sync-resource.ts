/** One line of the changes feed. A tombstone has no data: the record was deleted. */
export interface SyncChange {
  readonly resource: string;
  readonly id: string;
  readonly version: number;
  readonly deleted: boolean;
  readonly data: Record<string, unknown> | null;
}

/**
 * What the server decided about one mutation:
 * - applied: done (or already done: sending it again changes nothing)
 * - superseded: not applied because something else wins, a delete (ADR-0008). Expected, nothing for the person to fix
 * - rejected: not applied and the device must look at it: invalid data, an id that is not theirs, a resource this server does not know
 */
export type ApplyOutcome =
  | { readonly status: 'applied'; readonly version: number | null }
  | { readonly status: 'superseded'; readonly reason: 'deleted' }
  | { readonly status: 'rejected'; readonly reason: 'not_found' | 'invalid_data' | 'unknown_resource' };

/** A kind of record that can be synced. Each domain module adds one; the sync service only knows this interface. */
export interface SyncResource {
  readonly name: string;
  put(userId: string, id: string, data: unknown, now: Date): Promise<ApplyOutcome>;
  remove(userId: string, id: string, now: Date): Promise<ApplyOutcome>;
  /** The person's changes after this version, oldest first (the sync service merges the resources). */
  changesSince(userId: string, afterVersion: number, limit: number): Promise<SyncChange[]>;
}

export const SYNC_RESOURCES = Symbol('SYNC_RESOURCES');

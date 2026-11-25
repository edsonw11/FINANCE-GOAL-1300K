export interface SessionRecord {
  /** SHA-256 of the value the browser holds. */
  readonly idHash: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  insert(record: SessionRecord): Promise<void>;
  find(idHash: string): Promise<SessionRecord | null>;
  touch(idHash: string, at: Date): Promise<void>;
  delete(idHash: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<number>;
  /** Removes sessions whose absolute expiry is before `before`. */
  deleteExpired(before: Date): Promise<number>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

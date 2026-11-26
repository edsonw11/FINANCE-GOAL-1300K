export interface AuthFlowRecord {
  /** SHA-256 of the value the browser holds in the login cookie. */
  readonly idHash: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly returnTo: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface AuthFlowRepository {
  insert(record: AuthFlowRecord): Promise<void>;
  /** Takes the record and removes it in one step: a second call, even at the same time, gets null. */
  consume(idHash: string): Promise<AuthFlowRecord | null>;
  deleteExpired(before: Date): Promise<number>;
}

export const AUTH_FLOW_REPOSITORY = Symbol('AUTH_FLOW_REPOSITORY');

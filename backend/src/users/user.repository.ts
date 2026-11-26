import { type OidcIdentity } from '../auth/oidc-provider';

export interface UserRecord {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
}

export interface UserRepository {
  /** Finds the person by (issuer, subject), or creates them. Refreshes the e-mail, the name and the last login. Never matches on e-mail. */
  upsertFromIdentity(identity: OidcIdentity, now: Date): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

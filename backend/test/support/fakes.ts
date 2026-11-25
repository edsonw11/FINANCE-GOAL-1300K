import { randomUUID } from 'node:crypto';
import { type AccountChange, type AccountRecord, type AccountRepository, type SaveResult } from '../../src/accounts/account.repository';
import { type AuthFlowRecord, type AuthFlowRepository } from '../../src/auth/auth-flow.repository';
import { type AuthorizationRequest, type FlowSecrets, LoginFailedError, type OidcIdentity, type OidcProvider } from '../../src/auth/oidc-provider';
import { type SessionRecord, type SessionRepository } from '../../src/auth/session.repository';
import { type Clock } from '../../src/clock';
import { type MutationLog, type MutationOutcome } from '../../src/sync/mutation-log';
import { type UserRecord, type UserRepository } from '../../src/users/user.repository';

/** A clock the test moves by hand. */
export class FakeClock implements Clock {
  constructor(private current = new Date('2026-11-25T12:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(date: Date): void {
    this.current = new Date(date);
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly rows = new Map<string, SessionRecord>();
  async insert(record: SessionRecord) {
    if (this.rows.has(record.idHash)) throw new Error('duplicate session');
    this.rows.set(record.idHash, { ...record });
  }
  async find(idHash: string) {
    const row = this.rows.get(idHash);
    return row ? { ...row } : null;
  }
  async touch(idHash: string, at: Date) {
    const row = this.rows.get(idHash);
    if (row) this.rows.set(idHash, { ...row, lastSeenAt: at });
  }
  async delete(idHash: string) {
    this.rows.delete(idHash);
  }
  async deleteAllForUser(userId: string) {
    let count = 0;
    for (const [key, row] of this.rows) if (row.userId === userId && this.rows.delete(key)) count++;
    return count;
  }
  async deleteExpired(before: Date) {
    let count = 0;
    for (const [key, row] of this.rows) if (row.expiresAt.getTime() <= before.getTime() && this.rows.delete(key)) count++;
    return count;
  }
}

export class InMemoryAuthFlowRepository implements AuthFlowRepository {
  readonly rows = new Map<string, AuthFlowRecord>();
  async insert(record: AuthFlowRecord) {
    if (this.rows.has(record.idHash)) throw new Error('duplicate flow');
    this.rows.set(record.idHash, { ...record });
  }
  async consume(idHash: string) {
    const row = this.rows.get(idHash);
    this.rows.delete(idHash);
    return row ? { ...row } : null;
  }
  async deleteExpired(before: Date) {
    let count = 0;
    for (const [key, row] of this.rows) if (row.expiresAt.getTime() <= before.getTime() && this.rows.delete(key)) count++;
    return count;
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, UserRecord & { issuer: string; subject: string; lastLoginAt: Date }>();
  async upsertFromIdentity(identity: OidcIdentity, now: Date) {
    for (const user of this.users.values()) {
      if (user.issuer === identity.issuer && user.subject === identity.subject) {
        Object.assign(user, { email: identity.email, displayName: identity.displayName, lastLoginAt: now });
        return { id: user.id, email: user.email, displayName: user.displayName };
      }
    }
    const id = randomUUID();
    this.users.set(id, { id, issuer: identity.issuer, subject: identity.subject, email: identity.email, displayName: identity.displayName, lastLoginAt: now });
    return { id, email: identity.email, displayName: identity.displayName };
  }
  async findById(id: string) {
    const user = this.users.get(id);
    return user ? { id: user.id, email: user.email, displayName: user.displayName } : null;
  }
}

interface StoredAccount extends AccountRecord {
  readonly userId: string;
  readonly deletedAt: Date | null;
}

export class InMemoryAccountRepository implements AccountRepository {
  readonly rows = new Map<string, StoredAccount>();
  /** The change counter of each person, like the sync_cursor table. */
  readonly counters = new Map<string, number>();
  private bump(userId: string): number {
    const next = (this.counters.get(userId) ?? 0) + 1;
    this.counters.set(userId, next);
    return next;
  }
  private visible(row: StoredAccount): AccountRecord {
    return { id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt, version: row.version };
  }
  async list(userId: string) {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId && !r.deletedAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .map((r) => this.visible(r));
  }
  async find(userId: string, id: string) {
    const row = this.rows.get(id);
    return row && row.userId === userId && !row.deletedAt ? this.visible(row) : null;
  }
  async save(userId: string, id: string, name: string, now: Date): Promise<SaveResult> {
    const row = this.rows.get(id);
    if (row && row.userId !== userId) return { status: 'taken' };
    if (row?.deletedAt) return { status: 'deleted' };
    if (row && row.name === name) return { status: 'saved', account: this.visible(row) };
    const saved: StoredAccount = { id, userId, name, createdAt: row?.createdAt ?? now, updatedAt: now, deletedAt: null, version: this.bump(userId) };
    this.rows.set(id, saved);
    return { status: 'saved', account: this.visible(saved) };
  }
  async remove(userId: string, id: string, now: Date) {
    const row = this.rows.get(id);
    if (row && row.userId === userId && !row.deletedAt) this.rows.set(id, { ...row, deletedAt: now, updatedAt: now, version: this.bump(userId) });
  }
  async changesSince(userId: string, afterVersion: number, limit: number): Promise<AccountChange[]> {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId && r.version > afterVersion)
      .sort((a, b) => a.version - b.version)
      .slice(0, limit)
      .map((r) => ({ ...this.visible(r), deleted: r.deletedAt !== null }));
  }
}

export class InMemoryMutationLog implements MutationLog {
  readonly rows = new Map<string, MutationOutcome>();
  async find(userId: string, mutationId: string) {
    return this.rows.get(`${userId}/${mutationId}`) ?? null;
  }
  async record(userId: string, mutationId: string, outcome: MutationOutcome) {
    const key = `${userId}/${mutationId}`;
    if (!this.rows.has(key)) this.rows.set(key, outcome);
  }
}

/** The identity provider, scripted by the test. It checks state like the real one does. */
export class FakeOidcProvider implements OidcProvider {
  identity: OidcIdentity = { issuer: 'http://idp.test/realms/everfox', subject: 'sub-alice', email: 'alice@example.test', displayName: 'Alice' };
  failBegin: Error | null = null;
  endSession: string | null = 'http://idp.test/logout';
  failEndSession = false;
  readonly requests: AuthorizationRequest[] = [];
  readonly callbacks: { url: URL; expected: FlowSecrets }[] = [];

  async createAuthorizationRequest(): Promise<AuthorizationRequest> {
    if (this.failBegin) throw this.failBegin;
    const n = this.requests.length + 1;
    const request = {
      url: `http://idp.test/authorize?n=${n}`,
      state: `state-${n}-${randomUUID()}`,
      nonce: `nonce-${n}-${randomUUID()}`,
      codeVerifier: `verifier-${n}-${randomUUID()}`,
    };
    this.requests.push(request);
    return request;
  }

  async completeLogin(callbackUrl: URL, expected: FlowSecrets): Promise<OidcIdentity> {
    this.callbacks.push({ url: callbackUrl, expected });
    if (callbackUrl.searchParams.get('error')) throw new LoginFailedError('the provider answered with an error');
    if (callbackUrl.searchParams.get('state') !== expected.state) throw new LoginFailedError('state does not match');
    if (!callbackUrl.searchParams.get('code')) throw new LoginFailedError('no authorization code');
    return this.identity;
  }

  async endSessionUrl(): Promise<string | null> {
    if (this.failEndSession) throw new Error('provider unreachable');
    return this.endSession;
  }

  /** The address the identity provider would send the browser back to for the last login that was started. */
  callbackFor(extra = ''): string {
    const last = this.requests[this.requests.length - 1];
    if (!last) throw new Error('no login was started');
    return `/auth/callback?code=the-code&state=${encodeURIComponent(last.state)}${extra}`;
  }
}

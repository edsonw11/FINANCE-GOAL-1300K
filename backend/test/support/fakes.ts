import { randomUUID } from 'node:crypto';
import { type Body, type ImportItem, type ImportResult, type PutInput, type PutResult, type RecordKind, type RecordStore, type StoredRecord, type StoredState } from '../../src/records/record.store';
import { type AccountChange, type AccountRecord, type AccountRepository, type SaveResult } from '../../src/accounts/account.repository';
import { type AuthFlowRecord, type AuthFlowRepository } from '../../src/auth/auth-flow.repository';
import { type AuthorizationRequest, type FlowSecrets, LoginFailedError, type OidcIdentity, type OidcProvider } from '../../src/auth/oidc-provider';
import { type SessionRecord, type SessionRepository } from '../../src/auth/session.repository';
import { type Clock } from '../../src/clock';
import { type AuditEntry, type AuditRepository } from '../../src/plans/audit.repository';
import { type ChangeResult, type PlanRepository, type PlanView, type UserPlan } from '../../src/plans/plan.repository';
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

const DEFAULT_PLANS = (): Map<string, { name: string; features: Set<string> }> =>
  new Map([
    ['free', { name: 'Free', features: new Set<string>() }],
    ['pro', { name: 'Pro', features: new Set(['budgets.advanced', 'import.bank-files', 'investments.projection', 'report.monthly']) }],
  ]);

/** The plans as the migration seeds them. */
export class InMemoryPlanRepository implements PlanRepository {
  readonly plans = DEFAULT_PLANS();
  readonly userPlans = new Map<string, string>();
  readonly admins = new Set<string>();
  /** People that exist; setUserPlan on anybody else answers "no_user". Tests that do not care leave it empty and every id is accepted. */
  readonly knownUsers = new Set<string>();

  async planOf(userId: string): Promise<UserPlan | null> {
    if (this.knownUsers.size > 0 && !this.knownUsers.has(userId)) return null;
    const planId = this.userPlans.get(userId) ?? 'free';
    return { planId, planName: this.plans.get(planId)!.name, isAdmin: this.admins.has(userId) };
  }
  async featuresOf(planId: string) {
    return [...(this.plans.get(planId)?.features ?? [])].sort();
  }
  async listPlans(): Promise<PlanView[]> {
    return [...this.plans.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, p]) => ({ id, name: p.name, features: [...p.features].sort() }));
  }
  async addFeature(planId: string, key: string): Promise<ChangeResult> {
    const plan = this.plans.get(planId);
    if (!plan) return 'no_plan';
    if (plan.features.has(key)) return 'unchanged';
    plan.features.add(key);
    return 'changed';
  }
  async removeFeature(planId: string, key: string): Promise<ChangeResult> {
    const plan = this.plans.get(planId);
    if (!plan) return 'no_plan';
    return plan.features.delete(key) ? 'changed' : 'unchanged';
  }
  async setUserPlan(userId: string, planId: string): Promise<ChangeResult | 'no_user'> {
    if (!this.plans.has(planId)) return 'no_plan';
    if (this.knownUsers.size > 0 && !this.knownUsers.has(userId)) return 'no_user';
    if ((this.userPlans.get(userId) ?? 'free') === planId) return 'unchanged';
    this.userPlans.set(userId, planId);
    return 'changed';
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  readonly entries: (AuditEntry & { at: Date })[] = [];
  async record(entry: AuditEntry, now: Date) {
    this.entries.push({ ...entry, at: now });
  }
}

interface MemRecord extends StoredRecord {
  readonly userId: string;
}

/** The record store in memory: same rules as the PostgreSQL one, proven by the same contract. */
export class InMemoryRecordStore implements RecordStore {
  readonly rows = new Map<string, MemRecord>();
  readonly states = new Map<string, StoredState>();
  readonly counters = new Map<string, number>();
  private take(userId: string, n = 1): number {
    const first = (this.counters.get(userId) ?? 0) + 1;
    this.counters.set(userId, first + n - 1);
    return first;
  }
  private hasKey(userId: string, kind: RecordKind, key: string, exceptId: string) {
    return [...this.rows.values()].some((r) => r.userId === userId && r.kind === kind && r.legacyKey === key && r.id !== exceptId);
  }
  private pub(r: MemRecord): StoredRecord {
    const { userId: _u, ...rest } = r;
    return rest;
  }
  async put(userId: string, kind: RecordKind, id: string, input: PutInput, now: Date): Promise<PutResult> {
    const row = this.rows.get(id);
    if (row && (row.userId !== userId || row.kind !== kind)) return { status: 'taken' };
    if (row?.deleted) return { status: 'deleted' };
    const body = input.merge && row ? { ...row.body, ...input.body } : input.body;
    const key = input.legacyKey === undefined ? (row?.legacyKey ?? null) : input.legacyKey;
    if (row && JSON.stringify(sortKeys(row.body)) === JSON.stringify(sortKeys(body)) && key === row.legacyKey) return { status: 'saved', record: this.pub(row) };
    if (key !== null && key !== row?.legacyKey && this.hasKey(userId, kind, key, id)) return { status: 'key_taken' };
    const version = this.take(userId);
    const saved: MemRecord = { id, userId, kind, legacyKey: key, position: row?.position ?? version, body: structuredClone(body), createdAt: row?.createdAt ?? now, updatedAt: now, version, deleted: false };
    this.rows.set(id, saved);
    return { status: 'saved', record: this.pub(saved) };
  }
  async remove(userId: string, kind: RecordKind, id: string, now: Date) {
    const row = this.rows.get(id);
    if (row && row.userId === userId && row.kind === kind && !row.deleted) this.rows.set(id, { ...row, deleted: true, updatedAt: now, version: this.take(userId) });
  }
  async find(userId: string, kind: RecordKind, id: string) {
    const row = this.rows.get(id);
    return row && row.userId === userId && row.kind === kind && !row.deleted ? this.pub(row) : null;
  }
  async list(userId: string, kind: RecordKind) {
    return [...this.rows.values()].filter((r) => r.userId === userId && r.kind === kind && !r.deleted).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map((r) => this.pub(r));
  }
  async changesSince(userId: string, kind: RecordKind, after: number, limit: number) {
    return [...this.rows.values()].filter((r) => r.userId === userId && r.kind === kind && r.version > after).sort((a, b) => a.version - b.version).slice(0, limit).map((r) => this.pub(r));
  }
  async getState(userId: string) {
    return this.states.get(userId) ?? null;
  }
  async putState(userId: string, body: Body, now: Date): Promise<StoredState> {
    const current = this.states.get(userId);
    if (current && JSON.stringify(sortKeys(current.body)) === JSON.stringify(sortKeys(body))) return current;
    const next: StoredState = { body: structuredClone(body), version: this.take(userId), updatedAt: now };
    this.states.set(userId, next);
    return next;
  }
  async importAll(userId: string, items: readonly ImportItem[], state: Body, now: Date, replace: boolean): Promise<ImportResult> {
    const live = [...this.rows.values()].filter((r) => r.userId === userId && !r.deleted);
    if (live.length > 0 || this.states.has(userId)) {
      if (!replace) return { status: 'not_empty' };
      for (const r of live.sort((a, b) => a.position - b.position)) this.rows.set(r.id, { ...r, deleted: true, legacyKey: null, updatedAt: now, version: this.take(userId) });
      this.states.delete(userId);
    }
    for (const item of items) {
      const version = this.take(userId);
      this.rows.set(item.id, { id: item.id, userId, kind: item.kind, legacyKey: item.legacyKey, position: version, body: structuredClone(item.body), createdAt: now, updatedAt: now, version, deleted: false });
    }
    this.states.set(userId, { body: structuredClone(state), version: this.take(userId), updatedAt: now });
    return { status: 'imported', records: items.length };
  }
}

const sortKeys = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : v;

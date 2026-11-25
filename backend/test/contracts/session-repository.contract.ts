import { describe, expect, it } from 'vitest';
import { type SessionRecord, type SessionRepository } from '../../src/auth/session.repository';

export interface SessionRepositoryHarness {
  readonly repository: SessionRepository;
  /** A person that exists (the real table has a foreign key to the user). */
  newUserId(): Promise<string>;
}

const T0 = new Date('2026-11-25T12:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
let counter = 0;
const record = (userId: string, over: Partial<SessionRecord> = {}): SessionRecord => ({
  idHash: `hash-${process.pid}-${Date.now()}-${++counter}`,
  userId,
  createdAt: T0,
  lastSeenAt: T0,
  expiresAt: at(3_600_000),
  ...over,
});

/** What every SessionRepository must do. Runs against the in-memory one (unit) and the PostgreSQL one (integration). */
export function sessionRepositoryContract(label: string, harness: () => Promise<SessionRepositoryHarness>) {
  describe(`SessionRepository contract: ${label}`, () => {
    it('stores a session and finds it by its hash, with every field', async () => {
      const { repository, newUserId } = await harness();
      const r = record(await newUserId());
      await repository.insert(r);
      const found = await repository.find(r.idHash);
      expect(found).toMatchObject({ idHash: r.idHash, userId: r.userId });
      expect(found?.createdAt.getTime()).toBe(r.createdAt.getTime());
      expect(found?.lastSeenAt.getTime()).toBe(r.lastSeenAt.getTime());
      expect(found?.expiresAt.getTime()).toBe(r.expiresAt.getTime());
    });

    it('finds nothing for an unknown hash', async () => {
      const { repository } = await harness();
      expect(await repository.find('no-such-hash')).toBeNull();
    });

    it('refuses the same hash twice', async () => {
      const { repository, newUserId } = await harness();
      const r = record(await newUserId());
      await repository.insert(r);
      await expect(repository.insert(r)).rejects.toThrow();
    });

    it('touch moves lastSeenAt and nothing else', async () => {
      const { repository, newUserId } = await harness();
      const r = record(await newUserId());
      await repository.insert(r);
      await repository.touch(r.idHash, at(60_000));
      const found = await repository.find(r.idHash);
      expect(found?.lastSeenAt.getTime()).toBe(at(60_000).getTime());
      expect(found?.expiresAt.getTime()).toBe(r.expiresAt.getTime());
      expect(found?.createdAt.getTime()).toBe(r.createdAt.getTime());
    });

    it('touch on a missing session is not an error', async () => {
      const { repository } = await harness();
      await expect(repository.touch('no-such-hash', T0)).resolves.toBeUndefined();
    });

    it('delete removes only that session, and deleting a missing one is not an error', async () => {
      const { repository, newUserId } = await harness();
      const userId = await newUserId();
      const a = record(userId);
      const b = record(userId);
      await repository.insert(a);
      await repository.insert(b);
      await repository.delete(a.idHash);
      await repository.delete(a.idHash);
      expect(await repository.find(a.idHash)).toBeNull();
      expect(await repository.find(b.idHash)).not.toBeNull();
    });

    it('deleteAllForUser removes that person\'s sessions, counts them, and leaves other people alone', async () => {
      const { repository, newUserId } = await harness();
      const alice = await newUserId();
      const bob = await newUserId();
      const a1 = record(alice);
      const a2 = record(alice);
      const b1 = record(bob);
      for (const r of [a1, a2, b1]) await repository.insert(r);
      expect(await repository.deleteAllForUser(alice)).toBe(2);
      expect(await repository.find(a1.idHash)).toBeNull();
      expect(await repository.find(a2.idHash)).toBeNull();
      expect(await repository.find(b1.idHash)).not.toBeNull();
      expect(await repository.deleteAllForUser(alice)).toBe(0);
    });

    it('deleteExpired removes what expired at or before the limit, keeps the rest, and counts', async () => {
      const { repository, newUserId } = await harness();
      const userId = await newUserId();
      const old = record(userId, { createdAt: at(-1000), lastSeenAt: at(-1000), expiresAt: at(-1) });
      const exactly = record(userId, { createdAt: at(-1000), lastSeenAt: at(-1000), expiresAt: T0 });
      const later = record(userId, { expiresAt: at(1) });
      for (const r of [old, exactly, later]) await repository.insert(r);
      const removed = await repository.deleteExpired(T0);
      expect(removed).toBeGreaterThanOrEqual(2); // the shared database may hold other expired rows
      expect(await repository.find(old.idHash)).toBeNull();
      expect(await repository.find(exactly.idHash)).toBeNull();
      expect(await repository.find(later.idHash)).not.toBeNull();
    });
  });
}

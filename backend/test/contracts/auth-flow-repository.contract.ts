import { describe, expect, it } from 'vitest';
import { type AuthFlowRecord, type AuthFlowRepository } from '../../src/auth/auth-flow.repository';

const T0 = new Date('2026-11-25T12:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
let counter = 0;
const record = (over: Partial<AuthFlowRecord> = {}): AuthFlowRecord => ({
  idHash: `flow-${process.pid}-${Date.now()}-${++counter}`,
  state: 'the-state',
  nonce: 'the-nonce',
  codeVerifier: 'the-verifier',
  returnTo: '/somewhere?x=1#y',
  createdAt: T0,
  expiresAt: at(600_000),
  ...over,
});

/** What every AuthFlowRepository must do. Runs against the in-memory one (unit) and the PostgreSQL one (integration). */
export function authFlowRepositoryContract(label: string, make: () => Promise<AuthFlowRepository>) {
  describe(`AuthFlowRepository contract: ${label}`, () => {
    it('gives back what was stored, once', async () => {
      const repository = await make();
      const r = record();
      await repository.insert(r);
      const got = await repository.consume(r.idHash);
      expect(got).toMatchObject({ idHash: r.idHash, state: 'the-state', nonce: 'the-nonce', codeVerifier: 'the-verifier', returnTo: '/somewhere?x=1#y' });
      expect(got?.expiresAt.getTime()).toBe(r.expiresAt.getTime());
      expect(await repository.consume(r.idHash)).toBeNull();
    });

    it('knows nothing about an unknown hash', async () => {
      expect(await (await make()).consume('no-such-flow')).toBeNull();
    });

    it('of many simultaneous attempts to take the same record, exactly one gets it', async () => {
      const repository = await make();
      const r = record();
      await repository.insert(r);
      const results = await Promise.all(Array.from({ length: 20 }, () => repository.consume(r.idHash)));
      expect(results.filter((x) => x !== null)).toHaveLength(1);
    });

    it('refuses the same hash twice', async () => {
      const repository = await make();
      const r = record();
      await repository.insert(r);
      await expect(repository.insert(r)).rejects.toThrow();
    });

    it('keeps different attempts apart', async () => {
      const repository = await make();
      const a = record({ state: 'A' });
      const b = record({ state: 'B' });
      await repository.insert(a);
      await repository.insert(b);
      expect((await repository.consume(b.idHash))?.state).toBe('B');
      expect((await repository.consume(a.idHash))?.state).toBe('A');
    });

    it('deleteExpired removes attempts that expired at or before the limit, keeps the others, and counts', async () => {
      const repository = await make();
      const old = record({ expiresAt: at(-1) });
      const exactly = record({ expiresAt: T0 });
      const later = record({ expiresAt: at(1) });
      for (const r of [old, exactly, later]) await repository.insert(r);
      expect(await repository.deleteExpired(T0)).toBeGreaterThanOrEqual(2);
      expect(await repository.consume(old.idHash)).toBeNull();
      expect(await repository.consume(exactly.idHash)).toBeNull();
      expect(await repository.consume(later.idHash)).not.toBeNull();
    });
  });
}

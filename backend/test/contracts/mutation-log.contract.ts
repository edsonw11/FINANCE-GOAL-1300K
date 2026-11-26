import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type MutationLog } from '../../src/sync/mutation-log';

export interface MutationLogHarness {
  readonly log: MutationLog;
  newUserId(): Promise<string>;
}

const T0 = new Date('2026-11-26T12:00:00.000Z');

/** What every MutationLog must do: remember the first answer, per person. */
export function mutationLogContract(label: string, harness: () => Promise<MutationLogHarness>) {
  describe(`MutationLog contract: ${label}`, () => {
    it('finds nothing for a mutation never seen', async () => {
      const { log, newUserId } = await harness();
      expect(await log.find(await newUserId(), randomUUID())).toBeNull();
    });

    it('remembers each kind of answer exactly', async () => {
      const { log, newUserId } = await harness();
      const userId = await newUserId();
      const outcomes = [
        { status: 'applied', version: 7 },
        { status: 'applied', version: null },
        { status: 'superseded', reason: 'deleted' },
        { status: 'rejected', reason: 'invalid_data' },
      ] as const;
      for (const outcome of outcomes) {
        const id = randomUUID();
        await log.record(userId, id, outcome, T0);
        expect(await log.find(userId, id)).toEqual(outcome);
      }
    });

    it('keeps the first answer when the same mutation is recorded again', async () => {
      const { log, newUserId } = await harness();
      const userId = await newUserId();
      const id = randomUUID();
      await log.record(userId, id, { status: 'applied', version: 1 }, T0);
      await log.record(userId, id, { status: 'rejected', reason: 'not_found' }, T0);
      expect(await log.find(userId, id)).toEqual({ status: 'applied', version: 1 });
    });

    it('recording the same mutation many times at once is safe', async () => {
      const { log, newUserId } = await harness();
      const userId = await newUserId();
      const id = randomUUID();
      await Promise.all(Array.from({ length: 10 }, () => log.record(userId, id, { status: 'applied', version: 3 }, T0)));
      expect(await log.find(userId, id)).toEqual({ status: 'applied', version: 3 });
    });

    it('is per person: the same mutation id of another person is another entry', async () => {
      const { log, newUserId } = await harness();
      const [alice, bob] = [await newUserId(), await newUserId()];
      const id = randomUUID();
      await log.record(alice, id, { status: 'applied', version: 1 }, T0);
      expect(await log.find(bob, id)).toBeNull();
      await log.record(bob, id, { status: 'rejected', reason: 'invalid_data' }, T0);
      expect(await log.find(alice, id)).toEqual({ status: 'applied', version: 1 });
    });
  });
}

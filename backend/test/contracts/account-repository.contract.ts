import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type AccountRepository } from '../../src/accounts/account.repository';

export interface AccountRepositoryHarness {
  readonly repository: AccountRepository;
  /** A person that exists (the real table has a foreign key to the user). */
  newUserId(): Promise<string>;
}

const T0 = new Date('2026-11-25T12:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

/** What every AccountRepository must do, above all: a person only ever reaches their own records. */
export function accountRepositoryContract(label: string, harness: () => Promise<AccountRepositoryHarness>) {
  describe(`AccountRepository contract: ${label}`, () => {
    it('creates a record and reads it back', async () => {
      const { repository, newUserId } = await harness();
      const userId = await newUserId();
      const id = randomUUID();
      const saved = await repository.save(userId, id, 'Nubank', T0);
      expect(saved.status).toBe('saved');
      const found = await repository.find(userId, id);
      expect(found).toMatchObject({ id, name: 'Nubank' });
      expect(found?.createdAt.getTime()).toBe(T0.getTime());
      expect(found?.updatedAt.getTime()).toBe(T0.getTime());
    });

    it('saving the same thing twice is the same as saving it once', async () => {
      const { repository, newUserId } = await harness();
      const userId = await newUserId();
      const id = randomUUID();
      await repository.save(userId, id, 'Inter', T0);
      const again = await repository.save(userId, id, 'Inter', at(5000));
      expect(again.status).toBe('saved');
      expect(await repository.list(userId)).toHaveLength(1);
    });

    it('changing the name keeps the creation time and moves the update time', async () => {
      const { repository, newUserId } = await harness();
      const userId = await newUserId();
      const id = randomUUID();
      await repository.save(userId, id, 'Old', T0);
      await repository.save(userId, id, 'New', at(60_000));
      const found = await repository.find(userId, id);
      expect(found?.name).toBe('New');
      expect(found?.createdAt.getTime()).toBe(T0.getTime());
      expect(found?.updatedAt.getTime()).toBe(at(60_000).getTime());
    });

    it('lists only the person\'s own live records, oldest first', async () => {
      const { repository, newUserId } = await harness();
      const alice = await newUserId();
      const bob = await newUserId();
      const [a1, a2, a3, b1] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      await repository.save(alice, a2, 'second', at(1000));
      await repository.save(alice, a1, 'first', T0);
      await repository.save(alice, a3, 'to delete', at(2000));
      await repository.save(bob, b1, 'bob only', T0);
      await repository.remove(alice, a3, at(3000));
      expect((await repository.list(alice)).map((a) => a.name)).toEqual(['first', 'second']);
      expect((await repository.list(bob)).map((a) => a.name)).toEqual(['bob only']);
    });

    it('a person with no records gets an empty list', async () => {
      const { repository, newUserId } = await harness();
      expect(await repository.list(await newUserId())).toEqual([]);
    });

    describe('one person against another', () => {
      it('cannot read another person\'s record, even knowing its id', async () => {
        const { repository, newUserId } = await harness();
        const alice = await newUserId();
        const bob = await newUserId();
        const id = randomUUID();
        await repository.save(alice, id, 'Alice secret', T0);
        expect(await repository.find(bob, id)).toBeNull();
        expect(await repository.list(bob)).toEqual([]);
      });

      it('cannot overwrite another person\'s record with the same id, and the record stays as it was', async () => {
        const { repository, newUserId } = await harness();
        const alice = await newUserId();
        const bob = await newUserId();
        const id = randomUUID();
        await repository.save(alice, id, 'Alice secret', T0);
        expect(await repository.save(bob, id, 'Bob was here', at(1000))).toEqual({ status: 'taken' });
        expect(await repository.find(alice, id)).toMatchObject({ name: 'Alice secret' });
        expect((await repository.find(alice, id))?.updatedAt.getTime()).toBe(T0.getTime());
        expect(await repository.find(bob, id)).toBeNull();
      });

      it('cannot delete another person\'s record', async () => {
        const { repository, newUserId } = await harness();
        const alice = await newUserId();
        const bob = await newUserId();
        const id = randomUUID();
        await repository.save(alice, id, 'Alice secret', T0);
        await repository.remove(bob, id, at(1000));
        expect(await repository.find(alice, id)).toMatchObject({ name: 'Alice secret' });
      });

      it('gets the same "taken" answer for another person\'s deleted record (nothing about it leaks)', async () => {
        const { repository, newUserId } = await harness();
        const alice = await newUserId();
        const bob = await newUserId();
        const id = randomUUID();
        await repository.save(alice, id, 'x', T0);
        await repository.remove(alice, id, at(1000));
        expect(await repository.save(bob, id, 'y', at(2000))).toEqual({ status: 'taken' });
      });
    });

    describe('deleting', () => {
      it('hides the record from reads and lists', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        const id = randomUUID();
        await repository.save(userId, id, 'x', T0);
        await repository.remove(userId, id, at(1000));
        expect(await repository.find(userId, id)).toBeNull();
        expect(await repository.list(userId)).toEqual([]);
      });

      it('wins over a late create or edit: saving a deleted record answers "deleted" and does not bring it back', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        const id = randomUUID();
        await repository.save(userId, id, 'x', T0);
        await repository.remove(userId, id, at(1000));
        expect(await repository.save(userId, id, 'late retry', at(2000))).toEqual({ status: 'deleted' });
        expect(await repository.find(userId, id)).toBeNull();
      });

      it('is idempotent, and deleting what never existed is not an error', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        const id = randomUUID();
        await repository.save(userId, id, 'x', T0);
        await repository.remove(userId, id, at(1000));
        await expect(repository.remove(userId, id, at(2000))).resolves.toBeUndefined();
        await expect(repository.remove(userId, randomUUID(), at(2000))).resolves.toBeUndefined();
      });
    });

    it('survives many devices saving the same new record at once: one record, everybody told "saved"', async () => {
      const { repository, newUserId } = await harness();
      const userId = await newUserId();
      const id = randomUUID();
      const results = await Promise.all(Array.from({ length: 15 }, (_, i) => repository.save(userId, id, `device ${i}`, at(i))));
      expect(results.every((r) => r.status === 'saved')).toBe(true);
      expect(await repository.list(userId)).toHaveLength(1);
    });

    it('keeps text exactly as given (accents, emoji, quotes)', async () => {
      const { repository, newUserId } = await harness();
      const userId = await newUserId();
      const id = randomUUID();
      const name = `Poupança "Férias" 😀 ' ; -- <b>`;
      await repository.save(userId, id, name, T0);
      expect((await repository.find(userId, id))?.name).toBe(name);
    });
  });
}

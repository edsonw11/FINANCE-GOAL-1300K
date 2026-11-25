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

    describe('versions and the changes feed (sync)', () => {
      it('gives each change of a person the next version, starting at 1', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        const [a, b] = [randomUUID(), randomUUID()];
        const first = await repository.save(userId, a, 'A', T0);
        const second = await repository.save(userId, b, 'B', at(1));
        const renamed = await repository.save(userId, a, 'A2', at(2));
        const versions = [first, second, renamed].map((r) => (r.status === 'saved' ? r.account.version : -1));
        expect(versions).toEqual([1, 2, 3]);
      });

      it('saving what is already stored does not make a new version, and keeps the update time', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        const id = randomUUID();
        await repository.save(userId, id, 'Same', T0);
        const again = await repository.save(userId, id, 'Same', at(60_000));
        expect(again.status === 'saved' && again.account.version).toBe(1);
        expect(again.status === 'saved' && again.account.updatedAt.getTime()).toBe(T0.getTime());
        expect(await repository.changesSince(userId, 0, 10)).toHaveLength(1);
      });

      it('versions are per person: another person starts at 1 too and never shifts the first', async () => {
        const { repository, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        await repository.save(alice, randomUUID(), 'a1', T0);
        await repository.save(alice, randomUUID(), 'a2', T0);
        const b = await repository.save(bob, randomUUID(), 'b1', T0);
        expect(b.status === 'saved' && b.account.version).toBe(1);
      });

      it('the feed lists what changed after a version, oldest first, and only the person\'s own', async () => {
        const { repository, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        const [a1, a2] = [randomUUID(), randomUUID()];
        await repository.save(alice, a1, 'one', T0);
        await repository.save(bob, randomUUID(), 'bob secret', T0);
        await repository.save(alice, a2, 'two', T0);
        await repository.save(alice, a1, 'one again', T0);
        const all = await repository.changesSince(alice, 0, 10);
        expect(all.map((c) => [c.id, c.version, c.name])).toEqual([
          [a2, 2, 'two'],
          [a1, 3, 'one again'],
        ]);
        expect(JSON.stringify(all)).not.toContain('bob secret');
        expect((await repository.changesSince(alice, 2, 10)).map((c) => c.id)).toEqual([a1]);
        expect(await repository.changesSince(alice, 3, 10)).toEqual([]);
        expect(await repository.changesSince(alice, 999, 10)).toEqual([]);
      });

      it('a delete is a change too: the tombstone reaches the feed with its own version', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        const id = randomUUID();
        await repository.save(userId, id, 'Gone soon', T0);
        await repository.remove(userId, id, at(1000));
        const feed = await repository.changesSince(userId, 0, 10);
        expect(feed).toHaveLength(1);
        expect(feed[0]).toMatchObject({ id, deleted: true, version: 2 });
      });

      it('deleting twice, or something unknown, or someone else\'s, makes no new version', async () => {
        const { repository, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        const id = randomUUID();
        await repository.save(alice, id, 'x', T0);
        await repository.remove(bob, id, at(1));
        await repository.remove(alice, randomUUID(), at(2));
        await repository.remove(alice, id, at(3));
        await repository.remove(alice, id, at(4));
        const feed = await repository.changesSince(alice, 0, 10);
        expect(feed.map((c) => [c.version, c.deleted])).toEqual([[2, true]]);
        expect(await repository.changesSince(bob, 0, 10)).toEqual([]);
      });

      it('a late edit of a deleted record changes nothing in the feed', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        const id = randomUUID();
        await repository.save(userId, id, 'x', T0);
        await repository.remove(userId, id, at(1));
        expect((await repository.save(userId, id, 'late', at(2))).status).toBe('deleted');
        expect((await repository.changesSince(userId, 0, 10)).map((c) => c.version)).toEqual([2]);
      });

      it('another person trying the same id changes nothing in either feed', async () => {
        const { repository, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        const id = randomUUID();
        await repository.save(alice, id, 'mine', T0);
        expect((await repository.save(bob, id, 'taken', T0)).status).toBe('taken');
        expect(await repository.changesSince(bob, 0, 10)).toEqual([]);
        expect((await repository.changesSince(alice, 0, 10)).map((c) => c.name)).toEqual(['mine']);
      });

      it('the limit cuts the feed, and the next page starts after the last version', async () => {
        const { repository, newUserId } = await harness();
        const userId = await newUserId();
        for (let i = 0; i < 5; i++) await repository.save(userId, randomUUID(), `n${i}`, T0);
        const page1 = await repository.changesSince(userId, 0, 2);
        const page2 = await repository.changesSince(userId, page1[1]!.version, 2);
        const page3 = await repository.changesSince(userId, page2[1]!.version, 2);
        expect([page1, page2, page3].map((p) => p.map((c) => c.name))).toEqual([['n0', 'n1'], ['n2', 'n3'], ['n4']]);
      });
    });
  });
}

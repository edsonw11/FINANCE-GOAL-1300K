import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountSyncResource } from '../../../src/accounts/account-sync.resource';
import { type PushMutation } from '../../../src/sync/sync.schemas';
import { SyncService } from '../../../src/sync/sync.service';
import { type ApplyOutcome, type SyncChange, type SyncResource } from '../../../src/sync/sync-resource';
import { FakeClock, InMemoryAccountRepository, InMemoryMutationLog } from '../../support/fakes';

let clock: FakeClock;
let accounts: InMemoryAccountRepository;
let log: InMemoryMutationLog;
let sync: SyncService;
const alice = 'user-alice';
const bob = 'user-bob';

beforeEach(() => {
  clock = new FakeClock();
  accounts = new InMemoryAccountRepository();
  log = new InMemoryMutationLog();
  sync = new SyncService([new AccountSyncResource(accounts)], log, clock);
});

const put = (id: string, name: unknown, mutationId = randomUUID()): PushMutation => ({ mutationId, resource: 'account', op: 'put', id, data: { name } });
const del = (id: string, mutationId = randomUUID()): PushMutation => ({ mutationId, resource: 'account', op: 'delete', id });

describe('push: a device sends its outbox', () => {
  it('applies a put and answers with the version', async () => {
    const m = put(randomUUID(), 'Nubank');
    expect(await sync.push(alice, [m])).toEqual([{ mutationId: m.mutationId, status: 'applied', version: 1 }]);
    expect(await accounts.find(alice, m.id)).toMatchObject({ name: 'Nubank' });
  });

  it('applies a whole batch in order, and versions follow that order', async () => {
    const [a, b, c] = [put(randomUUID(), 'A'), put(randomUUID(), 'B'), put(randomUUID(), 'C')];
    const results = await sync.push(alice, [a, b, c]);
    expect(results.map((r) => (r.status === 'applied' ? r.version : null))).toEqual([1, 2, 3]);
  });

  it('create then rename then delete in one batch ends deleted', async () => {
    const id = randomUUID();
    const results = await sync.push(alice, [put(id, 'v1'), put(id, 'v2'), del(id)]);
    expect(results.every((r) => r.status === 'applied')).toBe(true);
    expect(await accounts.find(alice, id)).toBeNull();
    expect((await sync.changes(alice, 0, 10)).changes).toMatchObject([{ id, deleted: true, version: 3 }]);
  });

  describe('sending the same mutation again (a retry after a timeout)', () => {
    it('gives the same answer and changes nothing', async () => {
      const m = put(randomUUID(), 'Once');
      const first = await sync.push(alice, [m]);
      const second = await sync.push(alice, [m]);
      expect(second).toEqual(first);
      expect(await accounts.list(alice)).toHaveLength(1);
      expect((await sync.changes(alice, 0, 10)).changes).toHaveLength(1);
    });

    it('gives the FIRST answer even when things have moved on since (it was applied, then deleted)', async () => {
      const id = randomUUID();
      const create = put(id, 'x');
      await sync.push(alice, [create]);
      await sync.push(alice, [del(id)]);
      const replay = await sync.push(alice, [create]);
      expect(replay[0]).toMatchObject({ status: 'applied', version: 1 });
      expect(await accounts.find(alice, id)).toBeNull(); // and it did not come back
    });

    it('a retried batch with new entries at the end applies only the new ones', async () => {
      const a = put(randomUUID(), 'A');
      await sync.push(alice, [a]);
      const b = put(randomUUID(), 'B');
      const results = await sync.push(alice, [a, b]);
      expect(results.map((r) => r.status)).toEqual(['applied', 'applied']);
      expect(await accounts.list(alice)).toHaveLength(2);
      expect((await sync.changes(alice, 0, 10)).changes).toHaveLength(2);
    });

    it('the same mutation twice inside one batch is applied once', async () => {
      const m = put(randomUUID(), 'Dup');
      const results = await sync.push(alice, [m, m]);
      expect(results[0]).toEqual(results.length === 2 ? { ...results[1] } : null);
      expect((await sync.changes(alice, 0, 10)).changes).toHaveLength(1);
    });

    it('the same mutation id from another person is a different mutation', async () => {
      const id = randomUUID();
      const mutationId = randomUUID();
      await sync.push(alice, [put(randomUUID(), 'a', mutationId)]);
      const result = await sync.push(bob, [put(id, 'b', mutationId)]);
      expect(result[0]).toMatchObject({ status: 'applied' });
      expect(await accounts.find(bob, id)).toMatchObject({ name: 'b' });
    });
  });

  describe('what the server decides', () => {
    it('a delete wins over an edit that arrives later (superseded, not an error)', async () => {
      const id = randomUUID();
      await sync.push(alice, [put(id, 'x'), del(id)]);
      const late = put(id, 'edited on the other device');
      expect((await sync.push(alice, [late]))[0]).toEqual({ mutationId: late.mutationId, status: 'superseded', reason: 'deleted' });
      expect(await accounts.find(alice, id)).toBeNull();
    });

    it('a superseded mutation does not stop the batch', async () => {
      const id = randomUUID();
      await sync.push(alice, [put(id, 'x'), del(id)]);
      const results = await sync.push(alice, [put(id, 'late'), put(randomUUID(), 'next')]);
      expect(results.map((r) => r.status)).toEqual(['superseded', 'applied']);
    });

    it('the last edit to arrive wins', async () => {
      const id = randomUUID();
      await sync.push(alice, [put(id, 'from phone')]);
      await sync.push(alice, [put(id, 'from tablet')]);
      expect(await accounts.find(alice, id)).toMatchObject({ name: 'from tablet' });
    });

    it('an id of another person is rejected as not found, and nothing of theirs is touched or revealed', async () => {
      const id = randomUUID();
      await accounts.save(bob, id, 'bob private', clock.now());
      const m = put(id, 'hijack');
      const [result] = await sync.push(alice, [m]);
      expect(result).toEqual({ mutationId: m.mutationId, status: 'rejected', reason: 'not_found' });
      expect(JSON.stringify(result)).not.toContain('bob');
      expect(await accounts.find(bob, id)).toMatchObject({ name: 'bob private' });
    });

    it('deleting another person\'s id is "applied" like deleting an unknown id, and touches nothing', async () => {
      const id = randomUUID();
      await accounts.save(bob, id, 'bob private', clock.now());
      const [mine, unknown] = await sync.push(alice, [del(id), del(randomUUID())]);
      expect(mine).toMatchObject({ status: 'applied', version: null });
      expect({ ...unknown, mutationId: '' }).toEqual({ ...mine, mutationId: '' });
      expect(await accounts.find(bob, id)).not.toBeNull();
    });

    it.each([
      ['no data', undefined],
      ['an empty name', { name: '' }],
      ['a name that is too long', { name: 'a'.repeat(81) }],
      ['an unknown field', { name: 'x', admin: true }],
      ['a name that is not text', { name: 5 }],
      ['data that is not an object', 'hello'],
    ])('rejects %s as invalid data', async (_label, data) => {
      const m: PushMutation = { mutationId: randomUUID(), resource: 'account', op: 'put', id: randomUUID(), data };
      expect((await sync.push(alice, [m]))[0]).toEqual({ mutationId: m.mutationId, status: 'rejected', reason: 'invalid_data' });
      expect(await accounts.list(alice)).toEqual([]);
    });

    it('rejects a resource this server does not know', async () => {
      const m: PushMutation = { mutationId: randomUUID(), resource: 'spaceship', op: 'put', id: randomUUID(), data: {} };
      expect((await sync.push(alice, [m]))[0]).toMatchObject({ status: 'rejected', reason: 'unknown_resource' });
    });
  });

  describe('a rejected mutation stops the batch', () => {
    it('the ones before it stay applied, the ones after it are skipped and NOT remembered', async () => {
      const [a, bad, c] = [put(randomUUID(), 'A'), put(randomUUID(), ''), put(randomUUID(), 'C')];
      const results = await sync.push(alice, [a, bad, c]);
      expect(results.map((r) => r.status)).toEqual(['applied', 'rejected', 'skipped']);
      expect(await accounts.list(alice)).toHaveLength(1);
      expect(await log.find(alice, c.mutationId)).toBeNull();
    });

    it('after the device deals with it, the skipped one can be sent again and applies', async () => {
      const [bad, c] = [put(randomUUID(), ''), put(randomUUID(), 'C')];
      await sync.push(alice, [bad, c]);
      expect((await sync.push(alice, [c]))[0]).toMatchObject({ status: 'applied' });
    });

    it('a rejected mutation sent again is rejected again, the same way', async () => {
      const bad = put(randomUUID(), '');
      const first = await sync.push(alice, [bad]);
      expect(await sync.push(alice, [bad])).toEqual(first);
    });
  });

  it('an empty batch does nothing', async () => {
    expect(await sync.push(alice, [])).toEqual([]);
  });
});

describe('changes: a device asks what happened since its cursor', () => {
  it('starts from nothing and returns the cursor to use next', async () => {
    await sync.push(alice, [put(randomUUID(), 'A'), put(randomUUID(), 'B')]);
    const page = await sync.changes(alice, 0, 10);
    expect(page.changes.map((c) => c.version)).toEqual([1, 2]);
    expect(page).toMatchObject({ cursor: '2', hasMore: false });
    expect(page.changes[0]).toMatchObject({ resource: 'account', deleted: false, data: { name: 'A' } });
  });

  it('with nothing new it keeps the cursor it was given', async () => {
    await sync.push(alice, [put(randomUUID(), 'A')]);
    expect(await sync.changes(alice, 1, 10)).toEqual({ changes: [], cursor: '1', hasMore: false });
    expect(await sync.changes(bob, 0, 10)).toEqual({ changes: [], cursor: '0', hasMore: false });
  });

  it('pages exactly: hasMore is true only when there really is more', async () => {
    for (let i = 0; i < 5; i++) await sync.push(alice, [put(randomUUID(), `n${i}`)]);
    const p1 = await sync.changes(alice, 0, 2);
    const p2 = await sync.changes(alice, Number(p1.cursor), 2);
    const p3 = await sync.changes(alice, Number(p2.cursor), 2);
    expect([p1, p2, p3].map((p) => [p.changes.length, p.hasMore])).toEqual([[2, true], [2, true], [1, false]]);
    expect(await sync.changes(alice, 0, 5)).toMatchObject({ hasMore: false });
    expect(await sync.changes(alice, 0, 4)).toMatchObject({ hasMore: true });
  });

  it('a tombstone has no data', async () => {
    const id = randomUUID();
    await sync.push(alice, [put(id, 'secret name'), del(id)]);
    const [change] = (await sync.changes(alice, 0, 10)).changes;
    expect(change).toMatchObject({ id, deleted: true, data: null });
    expect(JSON.stringify(change)).not.toContain('secret name');
  });

  it('never shows another person\'s changes', async () => {
    await sync.push(bob, [put(randomUUID(), 'bob only')]);
    expect((await sync.changes(alice, 0, 10)).changes).toEqual([]);
  });

  it('merges several kinds of record by version', async () => {
    class Notes implements SyncResource {
      readonly name = 'note';
      constructor(private readonly versions: number[]) {}
      async put(): Promise<ApplyOutcome> {
        return { status: 'applied', version: null };
      }
      async remove(): Promise<ApplyOutcome> {
        return { status: 'applied', version: null };
      }
      async changesSince(_u: string, after: number, limit: number): Promise<SyncChange[]> {
        return this.versions.filter((v) => v > after).slice(0, limit).map((v) => ({ resource: 'note', id: `n${v}`, version: v, deleted: false, data: {} }));
      }
    }
    const two = new SyncService([new AccountSyncResource(accounts), new Notes([2, 4, 6])], log, clock);
    await accounts.save(alice, randomUUID(), 'a', clock.now()); // version 1
    await accounts.save(alice, randomUUID(), 'b', clock.now()); // version 2 too (separate fake counters): ordering is by version, then stable
    const page = await two.changes(alice, 0, 3);
    expect(page.changes.map((c) => c.version)).toEqual([1, 2, 2]);
    expect(page.hasMore).toBe(true);
    const all = await two.changes(alice, 0, 10);
    expect(all.changes.map((c) => c.version)).toEqual([1, 2, 2, 4, 6]);
  });
});

describe('two devices of the same person', () => {
  it('device B learns what device A did while offline, and then its own cursor is up to date', async () => {
    const phone = { cursor: '0' };
    const tablet = { cursor: '0' };
    const [x, y] = [randomUUID(), randomUUID()];

    await sync.push(alice, [put(x, 'bought coffee (phone, no signal)'), put(y, 'bus ticket (phone)')]);
    const forTablet = await sync.changes(alice, Number(tablet.cursor), 100);
    tablet.cursor = forTablet.cursor;
    expect(forTablet.changes.map((c) => c.id)).toEqual([x, y]);

    // the tablet edits one and deletes the other, the phone gets both on its next sync
    await sync.push(alice, [put(x, 'coffee (tablet)'), del(y)]);
    const forPhone = await sync.changes(alice, Number(phone.cursor), 100);
    phone.cursor = forPhone.cursor;
    const latest = new Map(forPhone.changes.map((c) => [c.id, c]));
    expect(latest.get(x)).toMatchObject({ deleted: false, data: { name: 'coffee (tablet)' } });
    expect(latest.get(y)).toMatchObject({ deleted: true });

    // nothing is repeated afterwards
    expect((await sync.changes(alice, Number(phone.cursor), 100)).changes).toEqual([]);
  });

  it('both edit the same record offline: the one that arrives last wins, and nobody is told it failed', async () => {
    const id = randomUUID();
    await sync.push(alice, [put(id, 'start')]);
    const fromPhone = await sync.push(alice, [put(id, 'phone edit')]);
    const fromTablet = await sync.push(alice, [put(id, 'tablet edit')]);
    expect([fromPhone[0]!.status, fromTablet[0]!.status]).toEqual(['applied', 'applied']);
    expect(await accounts.find(alice, id)).toMatchObject({ name: 'tablet edit' });
  });
});

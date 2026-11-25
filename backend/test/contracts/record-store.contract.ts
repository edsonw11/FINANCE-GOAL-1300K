import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type RecordStore } from '../../src/records/record.store';

export interface RecordStoreHarness {
  readonly store: RecordStore;
  newUserId(): Promise<string>;
}

const T0 = new Date('2026-11-28T12:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

/** What every RecordStore must do, above all: a person only ever reaches their own records. */
export function recordStoreContract(label: string, harness: () => Promise<RecordStoreHarness>) {
  describe(`RecordStore contract: ${label}`, () => {
    describe('put, find, list', () => {
      it('creates a record and reads it back with every field', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const id = randomUUID();
        const saved = await store.put(user, 'tx', id, { body: { type: 'despesa', value: 12.5, nested: { a: [1, 2] } }, legacyKey: '7' }, T0);
        expect(saved.status).toBe('saved');
        const found = await store.find(user, 'tx', id);
        expect(found).toMatchObject({ id, kind: 'tx', legacyKey: '7', body: { type: 'despesa', value: 12.5, nested: { a: [1, 2] } }, deleted: false, version: 1, position: 1 });
        expect(found?.createdAt.getTime()).toBe(T0.getTime());
      });

      it('keeps numbers, text, nulls, booleans and nesting exactly (the rules depend on it)', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const body = { a: 0.1, b: 700.55, c: -3, d: null, e: true, f: 'ação 💰', g: [], h: {}, i: [{ x: 1 }, 'y', null] };
        const id = randomUUID();
        await store.put(user, 'tx', id, { body }, T0);
        expect((await store.find(user, 'tx', id))?.body).toEqual(body);
      });

      it('the same save twice makes no new version and keeps the update time', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const id = randomUUID();
        await store.put(user, 'snap', id, { body: { v: 1, w: 2 } }, T0);
        const again = await store.put(user, 'snap', id, { body: { w: 2, v: 1 } }, at(60_000)); // same content, other key order
        expect(again.status === 'saved' && again.record.version).toBe(1);
        expect(again.status === 'saved' && again.record.updatedAt.getTime()).toBe(T0.getTime());
        expect(await store.changesSince(user, 'snap', 0, 10)).toHaveLength(1);
      });

      it('a change gets the next version, keeps the creation time and the position', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const [a, b] = [randomUUID(), randomUUID()];
        await store.put(user, 'tx', a, { body: { n: 1 } }, T0);
        await store.put(user, 'tx', b, { body: { n: 2 } }, at(1));
        const changed = await store.put(user, 'tx', a, { body: { n: 3 } }, at(2));
        expect(changed.status === 'saved' && [changed.record.version, changed.record.position, changed.record.createdAt.getTime(), changed.record.updatedAt.getTime()]).toEqual([3, 1, T0.getTime(), at(2).getTime()]);
      });

      it('merge adds fields and keeps the others; without merge the body is replaced', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const id = randomUUID();
        await store.put(user, 'account', id, { body: { name: 'Nubank', archived: true } }, T0);
        await store.put(user, 'account', id, { body: { name: 'Nu' }, merge: true }, at(1));
        expect((await store.find(user, 'account', id))?.body).toEqual({ name: 'Nu', archived: true });
        await store.put(user, 'account', id, { body: { name: 'Only' } }, at(2));
        expect((await store.find(user, 'account', id))?.body).toEqual({ name: 'Only' });
      });

      it('lists the live records of a kind in the order they were made, not by id or time given', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const ids = [randomUUID(), randomUUID(), randomUUID()];
        await store.put(user, 'tx', ids[2]!, { body: { n: 'first' } }, at(5000));
        await store.put(user, 'tx', ids[0]!, { body: { n: 'second' } }, T0);
        await store.put(user, 'tx', ids[1]!, { body: { n: 'third' } }, at(1));
        await store.put(user, 'snap', randomUUID(), { body: { n: 'other kind' } }, T0);
        expect((await store.list(user, 'tx')).map((r) => r.body.n)).toEqual(['first', 'second', 'third']);
      });

      it('renaming or editing does not move a record in the list', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const [a, b] = [randomUUID(), randomUUID()];
        await store.put(user, 'tx', a, { body: { n: 'a' } }, T0);
        await store.put(user, 'tx', b, { body: { n: 'b' } }, T0);
        await store.put(user, 'tx', a, { body: { n: 'a2' } }, at(1));
        expect((await store.list(user, 'tx')).map((r) => r.body.n)).toEqual(['a2', 'b']);
      });
    });

    describe('ownership', () => {
      it('another person cannot read, list, change, take over or delete it, and learns nothing', async () => {
        const { store, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        const id = randomUUID();
        await store.put(alice, 'tx', id, { body: { secret: 'alice only' } }, T0);
        expect(await store.find(bob, 'tx', id)).toBeNull();
        expect(await store.list(bob, 'tx')).toEqual([]);
        expect((await store.put(bob, 'tx', id, { body: { secret: 'hacked' } }, at(1))).status).toBe('taken');
        await store.remove(bob, 'tx', id, at(2));
        expect(await store.changesSince(bob, 'tx', 0, 10)).toEqual([]);
        expect((await store.find(alice, 'tx', id))?.body).toEqual({ secret: 'alice only' });
        expect((await store.changesSince(alice, 'tx', 0, 10)).map((c) => c.version)).toEqual([1]);
      });

      it('an id cannot be reused as another kind, not even by its owner', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const id = randomUUID();
        await store.put(user, 'tx', id, { body: { a: 1 } }, T0);
        expect((await store.put(user, 'snap', id, { body: { a: 2 } }, at(1))).status).toBe('taken');
        await store.remove(user, 'snap', id, at(2));
        expect(await store.find(user, 'tx', id)).not.toBeNull();
      });

      it('versions are per person', async () => {
        const { store, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        await store.put(alice, 'tx', randomUUID(), { body: {} }, T0);
        await store.put(alice, 'tx', randomUUID(), { body: {} }, T0);
        const b = await store.put(bob, 'tx', randomUUID(), { body: {} }, T0);
        expect(b.status === 'saved' && b.record.version).toBe(1);
      });
    });

    describe('legacy keys', () => {
      it('one key belongs to one record of a kind, per person', async () => {
        const { store, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        const first = randomUUID();
        await store.put(alice, 'account', first, { body: { name: 'a' }, legacyKey: 'nu' }, T0);
        expect((await store.put(alice, 'account', randomUUID(), { body: { name: 'b' }, legacyKey: 'nu' }, at(1))).status).toBe('key_taken');
        expect((await store.put(alice, 'tx', randomUUID(), { body: {}, legacyKey: 'nu' }, at(2))).status).toBe('saved'); // another kind
        expect((await store.put(bob, 'account', randomUUID(), { body: { name: 'c' }, legacyKey: 'nu' }, at(3))).status).toBe('saved'); // another person
      });

      it('moving a key onto one that is taken is refused and changes nothing', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const [a, b] = [randomUUID(), randomUUID()];
        await store.put(user, 'account', a, { body: { n: 1 }, legacyKey: 'x' }, T0);
        await store.put(user, 'account', b, { body: { n: 2 }, legacyKey: 'y' }, T0);
        expect((await store.put(user, 'account', b, { body: { n: 3 }, legacyKey: 'x' }, at(1))).status).toBe('key_taken');
        expect((await store.find(user, 'account', b))).toMatchObject({ legacyKey: 'y', body: { n: 2 }, version: 2 });
      });

      it('saving without a key keeps the one it has', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const id = randomUUID();
        await store.put(user, 'tx', id, { body: { n: 1 }, legacyKey: '42' }, T0);
        await store.put(user, 'tx', id, { body: { n: 2 } }, at(1));
        expect((await store.find(user, 'tx', id))?.legacyKey).toBe('42');
      });
    });

    describe('delete and the changes feed', () => {
      it('a delete is a change with its own version, and a late edit is told "deleted"', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const id = randomUUID();
        await store.put(user, 'tx', id, { body: { n: 1 } }, T0);
        await store.remove(user, 'tx', id, at(1000));
        expect(await store.find(user, 'tx', id)).toBeNull();
        expect(await store.list(user, 'tx')).toEqual([]);
        expect((await store.put(user, 'tx', id, { body: { n: 2 } }, at(2000))).status).toBe('deleted');
        const feed = await store.changesSince(user, 'tx', 0, 10);
        expect(feed.map((c) => [c.version, c.deleted])).toEqual([[2, true]]);
      });

      it('deleting twice, an unknown id, or someone else\'s makes no new version', async () => {
        const { store, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        const id = randomUUID();
        await store.put(alice, 'tx', id, { body: {} }, T0);
        await store.remove(bob, 'tx', id, at(1));
        await store.remove(alice, 'tx', randomUUID(), at(2));
        await store.remove(alice, 'tx', id, at(3));
        await store.remove(alice, 'tx', id, at(4));
        expect((await store.changesSince(alice, 'tx', 0, 10)).map((c) => c.version)).toEqual([2]);
      });

      it('the feed is per kind and per person, oldest first, and pages by version', async () => {
        const { store, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        for (let i = 0; i < 5; i++) await store.put(alice, 'tx', randomUUID(), { body: { i } }, T0);
        await store.put(alice, 'snap', randomUUID(), { body: { other: true } }, T0);
        await store.put(bob, 'tx', randomUUID(), { body: { bob: true } }, T0);
        const p1 = await store.changesSince(alice, 'tx', 0, 2);
        const p2 = await store.changesSince(alice, 'tx', p1[1]!.version, 2);
        const p3 = await store.changesSince(alice, 'tx', p2[1]!.version, 2);
        expect([p1, p2, p3].map((p) => p.map((c) => c.body.i))).toEqual([[0, 1], [2, 3], [4]]);
        expect(JSON.stringify([p1, p2, p3])).not.toContain('bob');
      });
    });

    describe('settings document', () => {
      it('is empty at first, saved, and a repeat changes nothing', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        expect(await store.getState(user)).toBeNull();
        const first = await store.putState(user, { goal: 1300000, rate: 12.5 }, T0);
        expect(first.version).toBe(1);
        const again = await store.putState(user, { rate: 12.5, goal: 1300000 }, at(1000));
        expect(again.version).toBe(1);
        expect(again.updatedAt.getTime()).toBe(T0.getTime());
        const changed = await store.putState(user, { goal: 1, rate: 12.5 }, at(2000));
        expect(changed.version).toBe(2);
        expect((await store.getState(user))?.body).toEqual({ goal: 1, rate: 12.5 });
      });

      it('belongs to one person, and shares the counter with their records', async () => {
        const { store, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        await store.put(alice, 'tx', randomUUID(), { body: {} }, T0);
        const state = await store.putState(alice, { a: 1 }, T0);
        expect(state.version).toBe(2);
        expect(await store.getState(bob)).toBeNull();
      });
    });

    describe('importAll', () => {
      const item = (kind: 'tx' | 'account', key: string, body: Record<string, unknown>) => ({ id: randomUUID(), kind, legacyKey: key, body });

      it('loads everything in order, with one version each, and the settings', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const items = [item('account', 'nu', { name: 'Nubank' }), item('tx', '1', { v: 1 }), item('tx', '2', { v: 2 }), item('tx', '3', { v: 3 })];
        expect(await store.importAll(user, items, { goal: 5 }, T0, false)).toEqual({ status: 'imported', records: 4 });
        expect((await store.list(user, 'tx')).map((r) => [r.legacyKey, r.version, r.position])).toEqual([['1', 2, 2], ['2', 3, 3], ['3', 4, 4]]);
        expect((await store.list(user, 'account')).map((r) => r.body.name)).toEqual(['Nubank']);
        expect((await store.getState(user))).toMatchObject({ body: { goal: 5 }, version: 5 });
      });

      it('refuses a person who already has data, and changes nothing', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        await store.put(user, 'tx', randomUUID(), { body: { mine: true } }, T0);
        expect(await store.importAll(user, [item('tx', '1', { v: 1 })], {}, at(1), false)).toEqual({ status: 'not_empty' });
        expect((await store.list(user, 'tx')).map((r) => r.body)).toEqual([{ mine: true }]);
        expect(await store.getState(user)).toBeNull();
      });

      it('with replace, the old data is deleted (other devices learn it) and the new data loaded', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        const oldId = randomUUID();
        await store.importAll(user, [{ id: oldId, kind: 'tx', legacyKey: '1', body: { old: true } }], { v: 1 }, T0, false);
        const result = await store.importAll(user, [item('tx', '1', { fresh: true })], { v: 2 }, at(1000), true);
        expect(result).toEqual({ status: 'imported', records: 1 });
        expect((await store.list(user, 'tx')).map((r) => r.body)).toEqual([{ fresh: true }]);
        expect((await store.getState(user))?.body).toEqual({ v: 2 });
        const feed = await store.changesSince(user, 'tx', 0, 10);
        expect(feed.find((c) => c.id === oldId)).toMatchObject({ deleted: true });
      });

      it('never touches another person', async () => {
        const { store, newUserId } = await harness();
        const [alice, bob] = [await newUserId(), await newUserId()];
        await store.importAll(alice, [item('tx', '1', { alice: true })], { a: 1 }, T0, false);
        await store.importAll(bob, [item('tx', '1', { bob: true })], { b: 1 }, T0, false);
        await store.importAll(bob, [item('tx', '1', { bob2: true })], { b: 2 }, at(1), true);
        expect((await store.list(alice, 'tx')).map((r) => r.body)).toEqual([{ alice: true }]);
        expect((await store.getState(alice))?.body).toEqual({ a: 1 });
      });

      it('an import with no records still saves the settings', async () => {
        const { store, newUserId } = await harness();
        const user = await newUserId();
        expect(await store.importAll(user, [], { goal: 1 }, T0, false)).toEqual({ status: 'imported', records: 0 });
        expect((await store.getState(user))?.body).toEqual({ goal: 1 });
      });
    });
  });
}

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenState } from './golden.contract';

const web = resolve(__dirname, '../../..', 'src', 'sync');
const load = async (file: string): Promise<any> => import(pathToFileURL(resolve(web, file)).href); // the browser app's own modules, untyped on purpose

const ORIGIN = 'http://localhost:3000';

export interface DeviceEnv {
  readonly app: NestFastifyApplication;
  /** Signs the person in through the real routes; returns the session cookie. */
  login(subject: string): Promise<string>;
}

type State = Record<string, any>;

/**
 * Devices running the REAL browser sync code (src/sync) against the REAL API: only the transport is replaced (app.inject instead of the network).
 * Whatever a device does, the server must end up with the same data, and the shared rules must give the same numbers on both sides.
 */
export function deviceSyncContract(label: string, env: () => Promise<DeviceEnv>) {
  describe(`devices against the API: ${label}`, () => {
    let runner: any;
    let client: any;
    let e: DeviceEnv;
    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-20T12:00:00'));
      [runner, client, e] = [await load('runner.js'), await load('api-client.js'), await env()];
    });
    afterEach(() => vi.useRealTimers());

    const storage = () => {
      const o: Record<string, string> = {};
      return { getItem: (k: string) => o[k] ?? null, setItem: (k: string, v: string) => void (o[k] = String(v)) };
    };

    /** A browser tab: its own local storage, its own state, its own cookie (shared by every tab of the same person only when we say so). */
    async function device(subject: string, initial?: State) {
      const d = {
        subject,
        cookie: await e.login(subject),
        online: true,
        state: (initial ?? { v: 2, goal: 1300000, rate: 12.5, planned: 0, nid: 1, accounts: [], snaps: [], tx: [] }) as State,
        storage: storage(),
        sync: null as any,
        add(t: State) {
          d.state = { ...d.state, tx: [...d.state.tx, { type: 'despesa', date: '2026-11-03', value: 1, cat: 'Mercado', fonte: 'caixa', desc: 'x', ...t, id: d.state.nid }], nid: d.state.nid + 1 };
        },
        remove(id: number) {
          d.state = { ...d.state, tx: d.state.tx.filter((t: State) => t.id !== id) };
        },
        async run() {
          return d.sync.run();
        },
      };
      const fetchLike = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
        if (!d.online) throw new TypeError('network down');
        const res = await e.app.inject({ method: init.method as 'GET', url, headers: { ...init.headers, cookie: d.cookie, origin: ORIGIN }, payload: init.body });
        return { status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, json: async () => res.json() };
      };
      const api = client.createApiClient(fetchLike);
      d.sync = runner.createSync({
        api,
        store: runner.metaStore(d.storage, 'meta'),
        getState: () => d.state,
        setState: (s: State) => void (d.state = s),
        newId: () => randomUUID(),
        newMutationId: () => randomUUID(),
        now: () => Date.now(),
      });
      const me = await api.me();
      expect(me.state).toBe('signed_in');
      expect(d.sync.bind(me.user.id)).toEqual({ ok: true });
      return d;
    }

    const person = () => `dev-${randomUUID()}`;
    const exported = async (cookie: string): Promise<State> => (await e.app.inject({ method: 'GET', url: '/api/v1/export/legacy-state', headers: { cookie } })).json();
    const monthResult = async (cookie: string, m: string) => (await e.app.inject({ method: 'GET', url: `/api/v1/months/${m}/result`, headers: { cookie } })).json();
    const sorted = (s: State) => ({ ...s, tx: [...s.tx].sort((a, b) => a.id - b.id), accounts: [...s.accounts].sort((a, b) => String(a.id).localeCompare(String(b.id))) });
    const asWire = (s: State) => JSON.parse(JSON.stringify(s)) as State;

    it('a device with the baseline history sends it all; a blank device gets it; the server and both devices agree, and the rules give the golden numbers', async () => {
      const subject = person();
      const a = await device(subject, goldenState());
      expect(await a.run()).toMatchObject({ ok: true, pending: 0 });
      const b = await device(subject);
      expect(await b.run()).toMatchObject({ ok: true, pending: 0 });

      expect(sorted(asWire(b.state)).tx).toEqual(sorted(asWire(a.state)).tx);
      expect(sorted(asWire(b.state)).accounts).toEqual(sorted(asWire(a.state)).accounts);
      expect(b.state.snaps).toHaveLength(a.state.snaps.length);
      expect(b.state.goal).toBe(a.state.goal);
      expect(sorted(await exported(a.cookie)).tx).toEqual(sorted(asWire(a.state)).tx);
      for (const m of ['2026-09', '2026-10', '2026-11']) expect(await monthResult(b.cookie, m)).toEqual(await monthResult(a.cookie, m));
    });

    it('an expense recorded with no network goes up later and shows in the monthly numbers of the server and of the other device', async () => {
      const subject = person();
      const a = await device(subject, goldenState());
      await a.run();
      const b = await device(subject);
      await b.run();
      const before = await monthResult(a.cookie, '2026-11');

      b.online = false;
      b.add({ value: 123.45, date: '2026-11-05' });
      expect(await b.run()).toMatchObject({ ok: false, reason: 'offline' });
      expect(b.sync.status().pending).toBeGreaterThan(0);
      expect((await a.run()).ok).toBe(true);
      expect(a.state.tx).toHaveLength(b.state.tx.length - 1);

      b.online = true;
      expect(await b.run()).toMatchObject({ ok: true, pending: 0 });
      expect((await a.run()).ok).toBe(true);
      expect(a.state.tx.find((t: State) => t.value === 123.45)).toBeDefined();
      const after = await monthResult(a.cookie, '2026-11');
      expect(after).not.toEqual(before);
      expect(await monthResult(b.cookie, '2026-11')).toEqual(after);
    });

    it('a delete reaches the other device, and the same number can be used again afterwards', async () => {
      const subject = person();
      const a = await device(subject);
      a.add({ value: 10 });
      await a.run();
      const b = await device(subject);
      await b.run();
      expect(b.state.tx).toHaveLength(1);
      a.remove(1);
      await a.run();
      await b.run();
      expect(b.state.tx).toHaveLength(0);
      a.state = { ...a.state, nid: 1 };
      a.add({ value: 20 });
      expect(a.state.tx[0].id).toBe(1);
      expect(await a.run()).toMatchObject({ ok: true, pending: 0 });
      expect(a.sync.status().review).toBe(0);
      await b.run();
      expect(b.state.tx.map((t: State) => t.value)).toEqual([20]);
    });

    it('the same history on two devices is not doubled', async () => {
      const subject = person();
      const a = await device(subject, goldenState());
      const b = await device(subject, goldenState());
      await a.run();
      await b.run();
      await a.run();
      const server = await exported(a.cookie);
      const baseline = goldenState() as State;
      expect(server.tx).toHaveLength(baseline.tx.length);
      expect(server.accounts).toHaveLength(baseline.accounts.length);
      expect([a.sync.status().review, b.sync.status().review]).toEqual([0, 0]);
    });

    it('two devices running at the same moment end with the same data', async () => {
      const subject = person();
      const a = await device(subject);
      const b = await device(subject);
      await a.run();
      await b.run();
      b.state = { ...b.state, nid: 500 }; // devices that already used the app do not hand out the same numbers
      a.add({ value: 1, desc: 'from a' });
      b.add({ value: 2, desc: 'from b' });
      await Promise.all([a.run(), b.run()]);
      await Promise.all([a.run(), b.run()]);
      expect((await exported(a.cookie)).tx).toHaveLength(2);
      expect(sorted(asWire(a.state)).tx).toEqual(sorted(asWire(b.state)).tx);
      expect(sorted(asWire(a.state)).tx.map((t: State) => t.desc)).toEqual(['from a', 'from b']);
    });

    it('two devices that offline used the same number: the second is put aside for review, nothing is overwritten', async () => {
      const subject = person();
      const a = await device(subject);
      const b = await device(subject);
      await a.run();
      await b.run();
      a.add({ value: 111, desc: 'from a' });
      b.add({ value: 222, desc: 'from b' });
      await a.run();
      expect(await b.run()).toMatchObject({ ok: true });
      expect(b.sync.status().review).toBeGreaterThan(0);
      const server = await exported(a.cookie);
      expect(server.tx.map((t: State) => t.desc)).toEqual(['from a']);
      expect(b.state.tx.find((t: State) => t.desc === 'from b')).toBeDefined(); // the device keeps what the person typed
    });

    it('a device that lost its login keeps everything and sends it after logging in again', async () => {
      const subject = person();
      const a = await device(subject);
      a.add({ value: 5 });
      await a.run();
      await e.app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: a.cookie, origin: ORIGIN, 'x-everfox-csrf': '1' } });
      a.add({ value: 6 });
      expect(await a.run()).toMatchObject({ ok: false, reason: 'unauthorized' });
      expect(a.sync.status().pending).toBeGreaterThan(0);
      expect(a.state.tx).toHaveLength(2);
      a.cookie = await e.login(subject);
      expect(await a.run()).toMatchObject({ ok: true, pending: 0 });
      expect((await exported(a.cookie)).tx).toHaveLength(2);
    });

    it('one person never receives another person\'s data, and the second person on the same device is refused', async () => {
      const a = await device(person(), goldenState());
      await a.run();
      const stranger = await device(person());
      expect(await stranger.run()).toMatchObject({ ok: true });
      expect(stranger.state.tx).toHaveLength(0);
      expect(stranger.state.accounts).toHaveLength(0);
      // somebody else signs in on the first device
      const other = await e.login(person());
      const me: any = await client.createApiClient(async (url: string, init: any) => {
        const res = await e.app.inject({ method: init.method, url, headers: { ...init.headers, cookie: other, origin: ORIGIN }, payload: init.body });
        return { status: res.statusCode, ok: res.statusCode < 300, json: async () => res.json() };
      }).me();
      expect(a.sync.bind(me.user.id)).toEqual({ ok: false, reason: 'other_account' });
    });

    it('an item the server refuses goes to review with its data, and the rest still arrives', async () => {
      const a = await device(person());
      a.add({ value: 1 });
      a.state = { ...a.state, tx: [...a.state.tx, { id: 99, type: 'despesa', date: 'not-a-date', value: 2 }] };
      a.add({ value: 3 });
      const result = await a.run();
      expect(result.ok).toBe(true);
      expect(a.sync.status().review).toBe(1);
      expect(a.sync.reviewItems()[0].data.body.id).toBe(99);
      expect(a.state.tx).toHaveLength(3);
      expect((await exported(a.cookie)).tx.map((t: State) => t.value).sort()).toEqual([1, 3]);
    });

    it('a long history (3000 transactions) goes in batches and a new device gets all of it', async () => {
      const subject = person();
      const a = await device(subject);
      for (let i = 0; i < 3000; i++) a.add({ value: i % 97 });
      expect(await a.run()).toMatchObject({ ok: true, pending: 0 });
      const b = await device(subject);
      expect(await b.run()).toMatchObject({ ok: true });
      expect(b.state.tx).toHaveLength(3000);
      expect(b.state.nid).toBe(3001);
    }, 120_000);
  });
}

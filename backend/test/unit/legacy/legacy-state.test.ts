import { describe, expect, it } from 'vitest';
import { emptyRecords, joinLegacyState, parseLegacyState, scanValue } from '../../../src/legacy/legacy-state';
import { type StoredRecord } from '../../../src/records/record.store';

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const base = (over: Record<string, unknown> = {}) => ({ v: 2, goal: 100, rate: 10, planned: 0, nid: 3, accounts: [{ id: 'nu', name: 'Nubank' }], snaps: [{ date: '2026-11-06', acc: 'nu', value: 10 }], tx: [{ id: 1, type: 'receita', date: '2026-11-01', value: 5 }], ...over });
const parse = (state: unknown) => parseLegacyState(state, newId);
const issues = (state: unknown) => {
  const r = parse(state);
  if (r.ok) throw new Error('expected a refusal');
  return r.issues;
};

/** Stores what parse made, the way the store does, to join it again. */
function store(parsed: ReturnType<typeof parse>) {
  if (!parsed.ok) throw new Error('refused');
  const records = emptyRecords();
  parsed.items.forEach((item, i) => {
    records[item.kind].push({ id: item.id, kind: item.kind, legacyKey: item.legacyKey, position: i + 1, body: item.body, createdAt: new Date(0), updatedAt: new Date(0), version: i + 1, deleted: false });
  });
  return { records, settings: parsed.settings };
}
const roundTrip = (state: unknown) => {
  const { records, settings } = store(parse(state));
  return joinLegacyState(records, settings);
};

describe('a state goes in and comes out the same', () => {
  it('a normal state', () => {
    const state = base({ cats: { despesa: [{ name: 'Mercado', icon: '🛒' }], receita: [] }, budgets: { Mercado: 500 }, card: { best: 25, due: 5 } });
    expect(roundTrip(state)).toEqual(state);
  });

  it('keeps the order of every list', () => {
    const tx = [3, 1, 2, 10].map((id) => ({ id, type: 'despesa', date: '2026-01-01', value: id }));
    expect((roundTrip(base({ tx })).tx as { id: number }[]).map((t) => t.id)).toEqual([3, 1, 2, 10]);
  });

  it('a list that was absent stays absent, and one that was empty stays empty', () => {
    const out = roundTrip({ v: 2, goal: 1, tx: [], accounts: [] });
    expect(out).toEqual({ v: 2, goal: 1, tx: [], accounts: [] });
    expect('snaps' in out).toBe(false);
    expect('trades' in out).toBe(false);
  });

  it('numeric ids stay numbers and text ids stay text', () => {
    const out = roundTrip(base({ trades: [{ id: 't7', key: 'k' }], transfers: [{ id: 12, pair: null }] }));
    expect(out.trades).toEqual([{ id: 't7', key: 'k' }]);
    expect(out.transfers).toEqual([{ id: 12, pair: null }]);
  });

  it('keeps numbers, nulls, text with accents and emoji, and nesting exactly', () => {
    const tx = [{ id: 1, type: 'despesa', date: '2026-01-01', value: 700.55, desc: 'Ação 💰 "aspas"', splits: [{ cat: 'a', value: 0.1 }], extra: null, flag: false }];
    expect(roundTrip(base({ tx })).tx).toEqual(tx);
  });

  it('a balance has no id: several on one day for one account are all kept', () => {
    const snaps = [{ date: '2026-01-01', acc: 'nu', value: 1 }, { date: '2026-01-01', acc: 'nu', value: 2 }];
    expect(roundTrip(base({ snaps })).snaps).toEqual(snaps);
  });

  it('imported files are keyed by their hash', () => {
    const parsed = parse(base({ imports: [{ hash: 'abc', name: 'x.csv', count: 3 }] }));
    expect(parsed.ok && parsed.items.find((i) => i.kind === 'import')?.legacyKey).toBe('abc');
  });

  it('settings the rules add later (anything unknown) travel along untouched', () => {
    const state = base({ futureThing: { a: [1, 2, { b: 3 }] }, ownNames: ['maria'] });
    expect(roundTrip(state)).toEqual(state);
  });

  it('a record made elsewhere without the browser\'s id gets one from its key, or its own id', () => {
    const rec = (over: Partial<StoredRecord>): StoredRecord => ({ id: 'uuid-1', kind: 'tx', legacyKey: null, position: 1, body: { type: 'despesa', date: '2026-01-01' }, createdAt: new Date(0), updatedAt: new Date(0), version: 1, deleted: false, ...over });
    const records = { ...emptyRecords(), tx: [rec({}), rec({ id: 'uuid-2', legacyKey: '42' })] };
    expect((joinLegacyState(records, {}).tx as { id: unknown }[]).map((t) => t.id)).toEqual(['uuid-1', '42']);
  });

  it('a person with records but no settings still gets their lists', () => {
    const records = { ...emptyRecords(), account: [{ id: 'u', kind: 'account' as const, legacyKey: null, position: 1, body: { name: 'N' }, createdAt: new Date(0), updatedAt: new Date(0), version: 1, deleted: false }] };
    expect(joinLegacyState(records, null)).toEqual({ accounts: [{ name: 'N', id: 'u' }] });
  });

  it('the mark of present lists never leaks into the state the rules read', () => {
    expect('_lists' in roundTrip(base())).toBe(false);
  });

  it('a "_lists" sent by the outside is ignored, not trusted', () => {
    const out = roundTrip(base({ _lists: ['trades', 'imports'] }));
    expect('trades' in out).toBe(false);
    expect('_lists' in out).toBe(false);
  });
});

describe('what is refused', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'state'],
    ['a number', 5],
  ])('%s is not a state', (_l, value) => {
    expect(issues(value)).toEqual([{ path: '', code: 'not_an_object' }]);
  });

  it.each(['accounts', 'snaps', 'tx', 'trades', 'transfers', 'imports'])('%s that is not a list', (name) => {
    expect(issues(base({ [name]: { a: 1 } }))).toContainEqual({ path: name, code: 'not_a_list' });
  });

  it.each([
    ['a transaction without a type', { tx: [{ id: 1, date: '2026-01-01' }] }, 'tx.0.type'],
    ['a transaction with a bad date', { tx: [{ id: 1, type: 'despesa', date: '01/02/2026' }] }, 'tx.0.date'],
    ['a transaction whose value is text', { tx: [{ id: 1, type: 'despesa', date: '2026-01-01', value: '5' }] }, 'tx.0.value'],
    ['a transaction with an absurd value', { tx: [{ id: 1, type: 'despesa', date: '2026-01-01', value: 1e15 }] }, 'tx.0.value'],
    ['a transaction that is not an object', { tx: ['x'] }, 'tx.0'],
    ['a balance without an account', { snaps: [{ date: '2026-01-01', value: 1 }] }, 'snaps.0.acc'],
    ['an account without a name', { accounts: [{ id: 'a' }] }, 'accounts.0.name'],
    ['an account with a huge name', { accounts: [{ id: 'a', name: 'x'.repeat(81) }] }, 'accounts.0.name'],
    ['an import without a hash', { imports: [{ name: 'x' }] }, 'imports.0.hash'],
    ['a trade without an id', { trades: [{ key: 'k' }] }, 'trades.0.id'],
  ])('%s', (_label, over, path) => {
    expect(issues(base(over)).map((i) => i.path)).toContain(path);
  });

  it('two records with the same key', () => {
    const tx = [{ id: 1, type: 'despesa', date: '2026-01-01' }, { id: 1, type: 'despesa', date: '2026-01-02' }];
    expect(issues(base({ tx }))).toContainEqual({ path: 'tx.1', code: 'duplicate_key' });
  });

  it('a number 1 and a text "1" are the same key (the key is text)', () => {
    const tx = [{ id: 1, type: 'despesa', date: '2026-01-01' }, { id: '1', type: 'despesa', date: '2026-01-02' }];
    expect(issues(base({ tx })).map((i) => i.code)).toContain('duplicate_key');
  });

  it('says what is wrong with each of the first problems, never echoing the value', () => {
    const found = issues(base({ tx: [{ id: 1, type: 'SECRET-TYPE'.repeat(5), date: 'SECRET-DATE' }] }));
    expect(JSON.stringify(found)).not.toContain('SECRET');
  });

  it('reports at most 20 problems', () => {
    expect(issues(base({ tx: Array.from({ length: 100 }, () => ({})) })).length).toBeLessThanOrEqual(20);
  });
});

describe('hostile content', () => {
  const evil = JSON.parse('{"__proto__": {"polluted": true}}') as object;

  it('a __proto__ key at the top, in a record, or deep in the settings is refused', () => {
    expect(issues(JSON.parse('{"v":2,"__proto__":{"x":1}}')).map((i) => i.code)).toContain('forbidden_key');
    expect(issues(base({ tx: [{ id: 1, type: 'despesa', date: '2026-01-01', ...evil }] })).map((i) => i.code)).toContain('forbidden_key');
    expect(issues(base({ cats: { a: [{ b: evil }] } })).map((i) => i.code)).toContain('forbidden_key');
  });

  it('nothing is polluted by trying', () => {
    parse(base({ tx: [{ id: 1, type: 'despesa', date: '2026-01-01', ...evil }] }));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('a record nested too deep, or with too many parts, is refused', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 20; i++) deep = { a: deep };
    expect(issues(base({ tx: [{ id: 1, type: 'despesa', date: '2026-01-01', deep }] })).map((i) => i.code)).toContain('too_deep');
    const wide = Array.from({ length: 6000 }, (_, i) => i);
    expect(issues(base({ tx: [{ id: 1, type: 'despesa', date: '2026-01-01', wide }] })).map((i) => i.code)).toContain('too_large');
  });

  it('settings too deep or too large are refused', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 20; i++) deep = { a: deep };
    expect(issues(base({ deep })).map((i) => i.code)).toContain('too_deep');
    expect(issues(base({ big: Array.from({ length: 60_000 }, (_, i) => i) })).map((i) => i.code)).toContain('too_large');
  });

  it('a NUL character, which PostgreSQL cannot store, is refused in text and in keys', () => {
    expect(issues(base({ tx: [{ id: 1, type: 'despesa', date: '2026-01-01', desc: 'a\u0000b' }] })).map((i) => i.code)).toContain('control_character');
    expect(issues(base({ note: 'a\u0000b' })).map((i) => i.code)).toContain('control_character');
    expect(issues(base({ ['k\u0000']: 1 })).map((i) => i.code)).toContain('control_character');
  });

  it('too many records', () => {
    const tx = Array.from({ length: 200_001 }, (_, i) => ({ id: i, type: 'despesa', date: '2026-01-01' }));
    expect(issues(base({ tx })).map((i) => i.code)).toContain('too_many_records');
  });

  it('keys that look like SQL or code are only data', () => {
    const state = base({ "x'; DROP TABLE record;--": 1, constructor: { a: 1 }, toString: 'x' });
    expect(roundTrip(state)).toMatchObject({ "x'; DROP TABLE record;--": 1, toString: 'x' });
  });
});

describe('scanValue', () => {
  it('accepts ordinary data', () => {
    expect(scanValue({ a: [1, 'x', null, { b: true }] }, 100)).toBeNull();
  });
  it('stops at the node limit exactly', () => {
    expect(scanValue([1, 2, 3], 4)).toBeNull();
    expect(scanValue([1, 2, 3], 3)).toBe('too_large');
  });
  it('depth limit: 10 levels are fine, 11 are not', () => {
    const nest = (d: number) => Array.from({ length: d }).reduce<unknown>((acc) => [acc], 1);
    expect(scanValue(nest(10), 1000)).toBeNull();
    expect(scanValue(nest(11), 1000)).toBe('too_deep');
  });
});

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { type Body, type ImportItem, type RecordKind, type StoredRecord } from '../records/record.store';
import { type LegacyState } from '../domain/domain-runtime';

/** The lists of the browser app's state, and the kind each becomes. Everything else in the state is the settings document. */
export const LISTS = { accounts: 'account', snaps: 'snap', tx: 'tx', trades: 'trade', transfers: 'transfer', imports: 'import' } as const satisfies Record<string, RecordKind>;
export type ListName = keyof typeof LISTS;
const LIST_NAMES = Object.keys(LISTS) as ListName[];

/** Which lists were present in the state (an absent list is not the same as an empty one for the rules), kept inside the settings. */
const LISTS_MARK = '_lists';

export const MAX_RECORDS = 200_000;
const MAX_DEPTH = 10;
const MAX_NODES_PER_RECORD = 5_000;
const MAX_NODES_SETTINGS = 50_000;
const FORBIDDEN_KEYS = new Set(['__proto__']);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.union([z.string().min(1).max(60), z.number().int().safe()]);
const amount = z.number().finite().min(-1e12).max(1e12);

/** What each kind must have to be usable by the rules. Anything else it carries is kept as it is. */
const RECORD_SCHEMAS = {
  account: z.looseObject({ id, name: z.string().min(1).max(80) }),
  snap: z.looseObject({ date, acc: z.union([z.string().min(1).max(60), z.number().int().safe()]), value: amount }),
  tx: z.looseObject({ id, type: z.string().min(1).max(20), date, value: amount.optional() }),
  trade: z.looseObject({ id }),
  transfer: z.looseObject({ id }),
  import: z.looseObject({ hash: z.string().min(1).max(200) }),
} as const satisfies Record<RecordKind, z.ZodType>;

/** The key a record had in the browser app ('nu', 12, 't7', the hash of an imported file), as text. Balances had none. */
const legacyKeyOf = (kind: RecordKind, body: Body): string | null => {
  if (kind === 'snap') return null;
  const raw = kind === 'import' ? body.hash : body.id;
  return raw === undefined || raw === null ? null : String(raw);
};

export interface Issue {
  readonly path: string;
  readonly code: string;
}

export type ParsedState = { readonly ok: true; readonly items: ImportItem[]; readonly settings: Body } | { readonly ok: false; readonly issues: Issue[] };

/** Walks a value without recursion limits of its own: refuses forbidden keys, too deep and too big. Returns what was wrong, if anything. */
export function scanValue(value: unknown, maxNodes: number): string | null {
  let nodes = 0;
  const stack: [unknown, number][] = [[value, 0]];
  while (stack.length > 0) {
    const [current, depth] = stack.pop()!;
    if (++nodes > maxNodes) return 'too_large';
    if (depth > MAX_DEPTH) return 'too_deep';
    if (typeof current === 'number' && !Number.isFinite(current)) return 'not_finite';
    if (current === null || typeof current !== 'object') {
      if (typeof current === 'string' && current.includes('\u0000')) return 'control_character';
      continue;
    }
    if (Array.isArray(current)) {
      for (const item of current) stack.push([item, depth + 1]);
      continue;
    }
    for (const [key, item] of Object.entries(current)) {
      if (FORBIDDEN_KEYS.has(key)) return 'forbidden_key';
      if (key.includes('\u0000')) return 'control_character';
      stack.push([item, depth + 1]);
    }
  }
  return null;
}

/** Splits the browser app's state into records and settings, checking everything on the way. Does not store anything. */
export function parseLegacyState(state: unknown, newId: () => string = randomUUID): ParsedState {
  const issues: Issue[] = [];
  if (state === null || typeof state !== 'object' || Array.isArray(state)) return { ok: false, issues: [{ path: '', code: 'not_an_object' }] };
  const source = state as Record<string, unknown>;
  const items: ImportItem[] = [];
  const settings: Body = {};
  const present: string[] = [];

  for (const [name, value] of Object.entries(source)) {
    if (FORBIDDEN_KEYS.has(name)) {
      issues.push({ path: name, code: 'forbidden_key' });
      continue;
    }
    if (!Object.hasOwn(LISTS, name)) {
      if (name === LISTS_MARK) continue; // ours, never taken from outside
      settings[name] = value;
      continue;
    }
    const listName = name as ListName;
    const kind = LISTS[listName];
    if (!Array.isArray(value)) {
      issues.push({ path: name, code: 'not_a_list' });
      continue;
    }
    present.push(name);
    const keys = new Set<string>();
    value.forEach((entry, index) => {
      const path = `${name}.${index}`;
      const checked = RECORD_SCHEMAS[kind].safeParse(entry);
      if (!checked.success) {
        issues.push(...checked.error.issues.slice(0, 3).map((i) => ({ path: [path, ...i.path].join('.'), code: i.code })));
        return;
      }
      const problem = scanValue(entry, MAX_NODES_PER_RECORD);
      if (problem) {
        issues.push({ path, code: problem });
        return;
      }
      const body = entry as Body;
      const legacyKey = legacyKeyOf(kind, body);
      if (legacyKey !== null) {
        if (keys.has(legacyKey)) {
          issues.push({ path, code: 'duplicate_key' });
          return;
        }
        keys.add(legacyKey);
      }
      items.push({ id: newId(), kind, legacyKey, body });
    });
  }
  if (items.length > MAX_RECORDS) issues.push({ path: '', code: 'too_many_records' });
  const problem = scanValue(settings, MAX_NODES_SETTINGS);
  if (problem) issues.push({ path: 'settings', code: problem });
  if (issues.length > 0) return { ok: false, issues: issues.slice(0, 20) };
  settings[LISTS_MARK] = present;
  return { ok: true, items, settings };
}

/** Puts records and settings back together as the state the rules read. The reverse of parseLegacyState. */
export function joinLegacyState(records: Readonly<Record<RecordKind, readonly StoredRecord[]>>, settings: Body | null): LegacyState {
  const state: LegacyState = {};
  const { [LISTS_MARK]: marked, ...rest } = settings ?? {};
  Object.assign(state, rest);
  const wanted = new Set<string>(Array.isArray(marked) ? (marked as string[]) : LIST_NAMES.filter((n) => records[LISTS[n]].length > 0));
  // lists the person has records for are always there, even when the mark is older than the records
  for (const name of LIST_NAMES) if (records[LISTS[name]].length > 0) wanted.add(name);
  for (const name of LIST_NAMES) {
    if (!wanted.has(name)) continue;
    const kind = LISTS[name];
    state[name] = records[kind].map((r) => withKey(kind, r));
  }
  return state;
}

/** A record made by a device or by the REST routes may lack the id the rules expect: it gets its key, or its own id. */
function withKey(kind: RecordKind, record: StoredRecord): Body {
  if (kind === 'snap' || kind === 'import') return structuredClone(record.body);
  if (record.body.id !== undefined) return structuredClone(record.body);
  return { ...structuredClone(record.body), id: record.legacyKey ?? record.id };
}

export const emptyRecords = (): Record<RecordKind, StoredRecord[]> => ({ account: [], snap: [], tx: [], trade: [], transfer: [], import: [] });

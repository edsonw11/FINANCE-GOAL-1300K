import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type DomainApi } from '../../src/domain/domain-runtime';
import { type FinanceRulesService } from '../../src/legacy/finance-rules.service';
import { type LegacyStateService } from '../../src/legacy/legacy-state.service';

const root = resolve(__dirname, '../../..');
// the baseline tool is CommonJS and builds the state in a vm: it is the one place that knows the invented data
const tool = createRequire(__filename)(resolve(root, 'tools/golden-calculations.cjs')) as {
  compute: (run: (code: string) => unknown) => unknown;
  goldenState: () => Record<string, unknown>;
  FROZEN: string;
};
export const GOLDEN_FILE = JSON.parse(readFileSync(resolve(root, 'docs/architecture/baseline/golden-calculations.json'), 'utf8')) as unknown;
export const goldenState = () => tool.goldenState();

export interface GoldenHarness {
  readonly state: LegacyStateService;
  readonly rules: FinanceRulesService;
  newUserId(): Promise<string>;
}

/** Evaluates the baseline's expressions with the shared rules in scope, the way the browser's vm does. */
const evaluator = (api: DomainApi) => {
  const names = Object.keys(api);
  const values = Object.values(api);
  return (code: string) => new Function(...names, `return (${code});`)(...values);
};

/**
 * The acceptance of Phase 4b: the baseline's invented data goes in through the import, is stored, comes back as a state,
 * and the shared rules calculate the SAME numbers the browser does (the committed golden file).
 */
export function goldenContract(label: string, harness: () => Promise<GoldenHarness>) {
  describe(`golden through the server: ${label}`, () => {
    beforeEach(() => {
      // the clock stands still, like in the baseline: every "today" in the rules is 2026-11-20
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(tool.FROZEN));
    });
    afterEach(() => vi.useRealTimers());

    it('imports the baseline state and gives back exactly the same state', async () => {
      const { state, newUserId } = await harness();
      const user = await newUserId();
      const original = goldenState();
      const summary = await state.importState(user, original, false);
      expect(summary.byKind).toEqual({ account: 2, snap: 6, tx: 20, trade: 0, transfer: 0, import: 0 });
      expect(await state.exportState(user)).toEqual(original);
    });

    it('calculates the same numbers as the browser: the whole golden file', async () => {
      const { state, rules, newUserId } = await harness();
      const user = await newUserId();
      await state.importState(user, goldenState(), false);
      const computed = await rules.compute(user, (api) => tool.compute(evaluator(api)));
      expect(JSON.parse(JSON.stringify(computed))).toEqual(GOLDEN_FILE);
    });

    it('a second import is refused and changes nothing; with replace it gives the same numbers again', async () => {
      const { state, rules, newUserId } = await harness();
      const user = await newUserId();
      await state.importState(user, goldenState(), false);
      await expect(state.importState(user, goldenState(), false)).rejects.toMatchObject({ response: { code: 'not_empty' } });
      await state.importState(user, goldenState(), true);
      const computed = await rules.compute(user, (api) => tool.compute(evaluator(api)));
      expect(JSON.parse(JSON.stringify(computed))).toEqual(GOLDEN_FILE);
      expect((await state.exportState(user)).tx).toHaveLength(20);
    });

    it('two people with different data get their own numbers, in any order', async () => {
      const { state, rules, newUserId } = await harness();
      const [a, b] = [await newUserId(), await newUserId()];
      await state.importState(a, goldenState(), false);
      const other = goldenState();
      (other.tx as { value: number }[]).forEach((t) => (t.value = t.value * 2));
      await state.importState(b, other, false);
      const income = (user: string) => rules.compute(user, (api) => (api.monthSummary as (m: string) => { income: { total: number } })('2026-10').income.total);
      const [ia, ib, ia2] = [await income(a), await income(b), await income(a)];
      expect(ib).toBe(ia * 2);
      expect(ia2).toBe(ia);
    });

    it('a person with nothing stored has nothing to export and zero in every month', async () => {
      const { state, rules, newUserId } = await harness();
      const user = await newUserId();
      await expect(state.exportState(user)).rejects.toMatchObject({ status: 404 });
      expect(await rules.compute(user, (api) => (api.monthSummary as (m: string) => { income: { total: number } })('2026-10').income.total)).toBe(0);
    });
  });
}

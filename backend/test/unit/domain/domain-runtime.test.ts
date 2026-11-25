import { describe, expect, it } from 'vitest';
import { loadDomain, runWithState } from '../../../src/domain/domain-runtime';

describe('the shared rules inside the API', () => {
  it('loads every function of the core and domain modules', async () => {
    const { api } = await loadDomain();
    for (const name of ['monthSummary', 'monthResult', 'buildReport', 'roundMoney', 'blankState', 'withState']) {
      if (name === 'withState') continue;
      expect(typeof api[name], name).toBe('function');
    }
    expect(Object.keys(api).length).toBeGreaterThan(200);
  });

  it('runs a rule against the state it is given', async () => {
    const state = { v: 2, goal: 100, rate: 10, planned: 0, nid: 3, accounts: [], snaps: [], tx: [{ id: 1, type: 'receita', date: '2026-10-05', value: 1000, cat: 'Salário', desc: 'x', fonte: 'caixa' }] };
    const { result } = await runWithState(state, (api) => (api.monthSummary as (m: string) => { income: { total: number } })('2026-10'));
    expect(result.income.total).toBe(1000);
  });

  it('two people in a row never see each other\'s data', async () => {
    const mk = (value: number) => ({ v: 2, goal: 1, rate: 1, planned: 0, nid: 2, accounts: [], snaps: [], tx: [{ id: 1, type: 'receita', date: '2026-10-05', value, cat: 'Salário', desc: 'x', fonte: 'caixa' }] });
    const sum = (api: Record<string, unknown>) => (api.monthSummary as (m: string) => { income: { total: number } })('2026-10').income.total;
    const [a, b, a2] = [await runWithState(mk(111), sum), await runWithState(mk(222), sum), await runWithState(mk(111), sum)];
    expect([a.result, b.result, a2.result]).toEqual([111, 222, 111]);
  });

  it('refuses an async function (the state must not stay in force while other code runs)', async () => {
    await expect(runWithState({ v: 2 }, (() => Promise.resolve(1)) as never)).rejects.toThrow(/synchronous/);
  });

  it('puts the previous state back when the rule throws', async () => {
    const state = { v: 2, goal: 1, rate: 1, planned: 0, nid: 1, accounts: [], snaps: [], tx: [] };
    await expect(runWithState(state, () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const ok = await runWithState(state, (api) => (api.monthSummary as (m: string) => { income: { total: number } })('2026-10').income.total);
    expect(ok.result).toBe(0);
  });
});

/**
 * domain/savings.js
 * Responsibility: the savings rate of a month: how much of the income was NOT spent, and a plain
 * level (good / ok / low / negative) so the screen can say it in one sentence. Pure read.
 */
import { roundMoney } from '../core/money.js';
import { monthSummary } from './month-summary.js';
export const SAVINGS_LEVEL={none:'none',negative:'negative',low:'low',ok:'ok',good:'good'};
export const SAVINGS_OK=0.1,SAVINGS_GOOD=0.2;
export function savingsLevel(rate){
  if(rate===null)return SAVINGS_LEVEL.none;
  if(rate<0)return SAVINGS_LEVEL.negative;
  if(rate>=SAVINGS_GOOD)return SAVINGS_LEVEL.good;
  if(rate>=SAVINGS_OK)return SAVINGS_LEVEL.ok;
  return SAVINGS_LEVEL.low;
}
// {income, expenses, saved, rate (null when there is no income), level}
export function savingsRate(m){
  const sm=monthSummary(m),income=sm.income.total,expenses=sm.expenses.total,saved=roundMoney(income-expenses);
  const rate=income>0?saved/income:null;
  return {income,expenses,saved,rate,level:savingsLevel(rate)};
}

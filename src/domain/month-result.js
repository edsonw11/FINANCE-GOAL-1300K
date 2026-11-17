/**
 * domain/month-result.js
 * Responsibility: the one answer to "how much was left this month": income minus expenses (the same
 * rule as the savings rate), split into what went to investments and what stayed in the account.
 * The Summary shows only this number for "left"; the cash-timing view (invoices paid, card purchases
 * not yet paid) stays inside its own detail list, so the screen never shows two different "left" values.
 */
import { roundMoney } from '../core/money.js';
import { monthSummary } from './month-summary.js';
import { savingsLevel } from './savings.js';
// {income, expenses, left, rate (null without income), level, invested, kept}
// kept = left - invested: positive = stayed in the account; negative = taken from the account (or savings)
export function monthResult(m){
  const sm=monthSummary(m),income=sm.income.total,expenses=sm.expenses.total,invested=sm.contributions.total;
  const left=roundMoney(income-expenses),rate=income>0?left/income:null;
  return {income,expenses,left,rate,level:savingsLevel(rate),invested,kept:roundMoney(left-invested)};
}

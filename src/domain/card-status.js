/**
 * domain/card-status.js
 * Responsibility: facts about one card invoice (identified by its due month): purchases of the
 * cycle, amount bought and paid, and its status on a given day.
 */
import { daysBetween } from '../core/dates.js';
import { sumMoney } from '../core/money.js';
import { S } from './store.js';
import { closeDateOf, dueDateOf, dueMonth, invoiceMonthOf } from './card-cycle.js';
export const cycleItems=fm=>S.tx.filter(t=>t.type==='despesa'&&t.fonte==='cartao'&&dueMonth(t.date)===fm).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
const invoicePayments=fm=>S.tx.filter(t=>t.type==='fatura'&&invoiceMonthOf(t)===fm);
export const cycleTotals=fm=>({bought:sumMoney(cycleItems(fm).map(t=>t.value)),paid:sumMoney(invoicePayments(fm).map(t=>t.value))});
// paid | open (still buying: days until closing) | closed (days until due) | late (due, no payment)
export function invoiceStatus(fm,day){
  if(cycleTotals(fm).paid>0)return {code:'paid',days:0};
  const close=closeDateOf(fm),due=dueDateOf(fm);
  if(day<=close)return {code:'open',days:daysBetween(day,close)};
  if(day<=due)return {code:'closed',days:daysBetween(day,due)};
  return {code:'late',days:0};
}

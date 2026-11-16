/**
 * domain/emergency-fund.js
 * Responsibility: the emergency reserve: how many months of expenses the accounts the user marked
 * as "reserve" can pay. Also the command that marks / unmarks an account.
 */
import { mIdx, mKey, mOf, today } from '../core/dates.js';
import { roundMoney } from '../core/money.js';
import { S } from './store.js';
import { balance } from './accounts.js';
import { monthSummary } from './month-summary.js';
export const RESERVE_TARGET_MONTHS=6,RESERVE_MIN_MONTHS=3,AVERAGE_MONTHS=3;
export const reserveAccounts=()=>S.accounts.filter(a=>a.reserve&&!a.archived);
export function setReserveAccount(id,flag){
  const a=S.accounts.find(x=>x.id===id);if(!a)return {error:'Conta não encontrada'};
  if(flag)a.reserve=true;else delete a.reserve;
  return {name:a.name};
}
// average expenses of the last closed months that have any expense (the month in progress is not complete)
export function monthlyExpenseAverage(day=today()){
  const cur=mOf(day),vals=[];
  for(let k=1;k<=AVERAGE_MONTHS;k++){const v=monthSummary(mKey(mIdx(cur)-k)).expenses.total;if(v>0)vals.push(v);}
  return vals.length?roundMoney(vals.reduce((s,v)=>s+v,0)/vals.length):0;
}
// {accounts, balance, monthlyExpense, months (null when it cannot be told), target, level}
export function emergencyFund(day=today()){
  const accs=reserveAccounts(),bal=roundMoney(accs.reduce((s,a)=>s+balance(a.id,day).v,0)),avg=monthlyExpenseAverage(day);
  const months=accs.length&&avg>0?bal/avg:null;
  const level=months===null?'none':months>=RESERVE_TARGET_MONTHS?'good':months>=RESERVE_MIN_MONTHS?'ok':'low';
  return {accounts:accs.map(a=>a.id),balance:bal,monthlyExpense:avg,months,target:RESERVE_TARGET_MONTHS,level};
}

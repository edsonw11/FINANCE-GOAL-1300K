/**
 * domain/todo-list.js
 * Responsibility: "what to do now": the few things worth the user's attention today (late or due
 * invoices, budgets over the limit, monthly bills not yet entered, no contribution this month),
 * most urgent first. Pure read; each item says what to open (go) so the screen can link to it.
 */
import { mOf, today } from '../core/dates.js';
import { roundMoney } from '../core/money.js';
import { S } from './store.js';
import { payableInvoices } from './card-invoices.js';
import { invoiceStatus } from './card-status.js';
import { budgetStatus, BUDGET_LEVEL } from './budgets.js';
import { monthlyBills, BILL_STATUS } from './monthly-bills.js';
import { isNewContribution } from './reinvestment.js';
export const MAX_ACTIONS=3;
export const ACTION={late:'invoice-late',due:'invoice-due',budget:'budget-over',bills:'bills-missing',contribute:'no-contribution',reserve:'no-reserve'};
const DUE_SOON_DAYS=7;
// item: {code, urgency (lower = first), go:'card'|'budget'|'bills'|'invest', data}
export function nextActions(day=today()){
  const m=mOf(day),items=[];
  const late=[];
  payableInvoices().forEach(f=>{const st=invoiceStatus(f.fm,day);
    if(st.code==='late')late.push(f);
    else if(st.code==='closed'&&st.days<=DUE_SOON_DAYS)items.push({code:ACTION.due,urgency:1,go:'card',data:{fm:f.fm,rest:f.rest,days:st.days}});});
  // several late invoices are one problem: say it once, with the count and the total
  if(late.length)items.push({code:ACTION.late,urgency:0,go:'card',data:{count:late.length,fm:late[0].fm,rest:roundMoney(late.reduce((t,f)=>t+f.rest,0))}});
  const over=budgetStatus(m,day).rows.filter(r=>r.level===BUDGET_LEVEL.over);
  if(over.length)items.push({code:ACTION.budget,urgency:2,go:'budget',data:{groups:over.map(r=>r.group)}});
  const missing=monthlyBills(m,day).items.filter(i=>i.status===BILL_STATUS.missing&&i.date<=day);
  if(missing.length)items.push({code:ACTION.bills,urgency:3,go:'bills',data:{count:missing.length}});
  // only worth saying when the user already invests (some account) and nothing went in this month
  const invests=S.accounts.some(a=>!a.archived),contributed=S.tx.some(t=>isNewContribution(t)&&mOf(t.date)===m);
  if(invests&&!contributed&&day.slice(8)>='10')items.push({code:ACTION.contribute,urgency:4,go:'invest',data:{}});
  // investments exist but none is marked as the emergency reserve (the reserve card stays hidden until then)
  if(invests&&!S.accounts.some(a=>a.reserve&&!a.archived))items.push({code:ACTION.reserve,urgency:5,go:'invest',data:{}});
  return items.sort((a,b)=>a.urgency-b.urgency).slice(0,MAX_ACTIONS);
}

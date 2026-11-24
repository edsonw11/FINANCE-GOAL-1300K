/**
 * domain/report.js
 * Responsibility: every number of the printed report (PDF) of one month, in one place: the month result,
 * what needs attention, the goal, where the money went (by group), the last months, the biggest
 * expenses, the investments, the card invoice, the budgets and the emergency reserve. Pure read: the
 * words and the layout live in ui/views/report-html.js. Reuses the same domain functions as the screens,
 * so the report never disagrees with the app.
 * buildReport(m, day = today) -> {m, day, current, hasData, month, compare, attention, goal, spending, trend,
 *   biggest, investments, card, budgets, reserve}
 */
import { asOf, mIdx, mKey, mOf, today } from '../core/dates.js';
import { roundMoney } from '../core/money.js';
import { S } from './store.js';
import { total } from './accounts.js';
import { monthResult } from './month-result.js';
import { monthSummary } from './month-summary.js';
import { groupMonth } from './spending.js';
import { investmentDistribution, project, realSeries } from './investments.js';
import { dueDateOf, dueMonth } from './card-cycle.js';
import { cycleTotals } from './card-status.js';
import { emergencyFund } from './emergency-fund.js';
import { budgetStatus } from './budgets.js';
import { nextActions } from './todo-list.js';
export const REPORT_MONTHS=6,REPORT_GROUPS=6,REPORT_BIGGEST=5,REPORT_OTHER_GROUP='Outros';
const EPS=0.004;
// the biggest groups, the small ones together as "Outros"; share = part of the month's expenses
function groupsOf(m,expenses){
  const rows=Object.entries(groupMonth(m)).filter(([,v])=>v>EPS).map(([name,value])=>({name,value:roundMoney(value)}))
    .sort((a,b)=>b.value-a.value);
  const top=rows.slice(0,REPORT_GROUPS),rest=rows.slice(REPORT_GROUPS);
  if(rest.length)top.push({name:REPORT_OTHER_GROUP,value:roundMoney(rest.reduce((t,r)=>t+r.value,0)),count:rest.length});
  return top.map(r=>({...r,share:expenses>0?r.value/expenses:0}));
}
// the last months up to m (empty months before the first record are left out); average = of the closed ones
function trendOf(m,current){
  const all=[];
  for(let k=REPORT_MONTHS-1;k>=0;k--){const x=mKey(mIdx(m)-k),r=monthResult(x);all.push({m:x,income:r.income,expenses:r.expenses,left:r.left});}
  const first=all.findIndex(r=>r.income>EPS||r.expenses>EPS),rows=first<0?all.slice(-1):all.slice(first);
  const closed=rows.filter((r,i)=>!(current&&i===rows.length-1)&&(r.income>EPS||r.expenses>EPS));
  return {rows,averageLeft:closed.length?roundMoney(closed.reduce((t,r)=>t+r.left,0)/closed.length):null};
}
function goalOf(m){
  const real=realSeries(),last=real[real.length-1],{hit}=project(real),net=total(asOf(m));
  return {target:S.goal,networth:roundMoney(net),progress:S.goal>0?Math.min(Math.max(net/S.goal,0),1):0,remaining:roundMoney(Math.max(S.goal-net,0)),
    planned:S.planned,rate:S.rate,monthsLeft:hit,reached:hit===0,etaMonth:hit>0?mKey(mIdx(last.m)+hit):null};
}
// the invoice that is open today, when something is left to pay
function cardOf(day){
  const fm=dueMonth(day),t=cycleTotals(fm),rest=roundMoney(Math.max(0,t.bought-t.paid));
  return rest>EPS?{fm,rest,due:dueDateOf(fm)}:null;
}
export function buildReport(m,day=today()){
  const current=m===mOf(day),month=monthResult(m),sm=monthSummary(m),goal=goalOf(m);
  const prevM=mKey(mIdx(m)-1),prev=monthResult(prevM);
  // a month in progress is not comparable with a whole one
  const compare=!current&&prev.expenses>EPS?{m:prevM,expenses:prev.expenses,delta:roundMoney(month.expenses-prev.expenses),pct:(month.expenses-prev.expenses)/prev.expenses}:null;
  const dist=investmentDistribution(asOf(m),'account'),bs=budgetStatus(m,day),reserve=emergencyFund(day);
  return {m,day,current,hasData:month.income>EPS||month.expenses>EPS||month.invested>EPS||goal.networth>EPS,
    month,compare,attention:current?nextActions(day):[],goal,
    spending:groupsOf(m,month.expenses),trend:trendOf(m,current),
    biggest:sm.expenses.items.slice().sort((a,b)=>b.value-a.value||a.date.localeCompare(b.date)).slice(0,REPORT_BIGGEST)
      .map(t=>({date:t.date,desc:t.desc||t.cat,cat:t.cat,value:t.value})),
    investments:dist.items.length?dist:null,card:current?cardOf(day):null,
    budgets:bs.rows.length?bs:null,reserve:reserve.accounts.length?reserve:null};
}

/**
 * domain/budgets.js
 * Responsibility: monthly budget per expense group ("Moradia até R$ 1.100/mês"): set it, and how
 * each group is doing in a month (spent, remaining, near/over the limit, pace of the current month).
 */
import { mOf, today } from '../core/dates.js';
import { roundMoney, sumMoney } from '../core/money.js';
import { S } from './store.js';
import { groupNames } from './category-groups.js';
import { groupMonth } from './spending.js';
// share of the budget from which the group is shown as "near the limit"
export const NEAR_LIMIT=0.8;
export const BUDGET_LEVEL={ok:'ok',near:'near',over:'over'};
export const budgetOf=group=>((S.budgets||{})[group])||0;
// value <= 0 (or empty) removes the budget
export function setBudget(group,value){
  if(!group)return {error:'Escolha o grupo'};
  const v=roundMoney(+value||0);
  if(v<0)return {error:'O orçamento não pode ser negativo'};
  S.budgets=S.budgets||{};
  if(v===0){delete S.budgets[group];return {group,value:0};}
  S.budgets[group]=v;return {group,value:v};
}
const levelOf=share=>share>1+1e-9?BUDGET_LEVEL.over:share>=NEAR_LIMIT?BUDGET_LEVEL.near:BUDGET_LEVEL.ok;
// days elapsed / days in month (1 for past months, 0 for future ones)
function monthProgress(m,day){
  const cur=mOf(day);if(m<cur)return 1;if(m>cur)return 0;
  const [y,mo,d]=day.split('-').map(Number);return d/new Date(y,mo,0).getDate();
}
/**
 * budgetStatus(m, day = today):
 *   {rows:[{group, budget, spent, remaining, share, level, projected, onPaceToExceed}], budget, spent, remaining}
 * Only groups with a budget. Rows: over first, then near, then by share. "projected" is the spending
 * at the current pace by the end of the month (only for the month in progress).
 */
export function budgetStatus(m,day=today()){
  const spentBy=groupMonth(m),progress=monthProgress(m,day);
  const names=Object.keys(S.budgets||{}).filter(g=>budgetOf(g)>0);
  const order=groupNames();
  const rows=names.map(group=>{
    const budget=budgetOf(group),spent=spentBy[group]||0,share=spent/budget;
    const projected=progress>0&&progress<1?roundMoney(spent/progress):null;
    return {group,budget,spent,remaining:roundMoney(budget-spent),share,level:levelOf(share),projected,
      onPaceToExceed:projected!==null&&share<=1&&projected>budget};
  }).sort((a,b)=>b.share-a.share||order.indexOf(a.group)-order.indexOf(b.group));
  const budget=sumMoney(rows.map(r=>r.budget)),spent=sumMoney(rows.map(r=>r.spent));
  return {rows,budget,spent,remaining:roundMoney(budget-spent)};
}
// groups of the given categories that are near or over their budget in month m (used after a save)
export function budgetAlerts(m,cats,groupOfCat,day=today()){
  const groups=new Set(cats.map(groupOfCat));
  return budgetStatus(m,day).rows.filter(r=>groups.has(r.group)&&r.level!==BUDGET_LEVEL.ok);
}

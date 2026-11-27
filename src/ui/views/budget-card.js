/**
 * ui/views/budget-card.js
 * Responsibility: Summary tab card "Orçamento do mês": each group with a budget, how much was
 * spent, what is left and a warning near/over the limit (rules in domain/budgets.js).
 * Tap a group to open its detail; budgets are set in the Categorias tab.
 */
import { $, esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { f0, f2 } from '../../core/format.js';
import { mOf, today } from '../../core/dates.js';
import { BUDGET_LEVEL, budgetStatus } from '../../domain/budgets.js';
import { groupIcon } from '../../domain/category-groups.js';
import { ui } from '../ui-state.js';
import { progressBar } from '../components/progress-bar.js';
const percent=x=>Math.round(x*100)+'%';
// the short line under each group
export function budgetLine(r,inProgress){
  if(r.level===BUDGET_LEVEL.over)return t('sum.budget.over',{amount:f2(-r.remaining),percent:percent(r.share)});
  const p={remaining:f2(r.remaining),percent:percent(r.share)};
  if(inProgress&&r.onPaceToExceed)return t('sum.budget.leftPace',{...p,projected:f0(r.projected)});
  if(r.level===BUDGET_LEVEL.near)return t('sum.budget.leftNear',p);
  return t('sum.budget.left',p);
}
export function renderBudgets(){
  const box=$('budgetCard'),st=budgetStatus(ui.cur),inProgress=ui.cur===mOf(today());
  if(!st.rows.length){
    box.innerHTML=`<div class="card-h"><h2 class="card-t">${t('sum.budget.title')}</h2></div>
      <div class="help flush">${t('sum.budget.emptyHelp')}</div>
      <button type="button" class="btn sm bud-set" data-go="tab" data-t="cad">${t('sum.budget.setBtn')}</button>`;
    return;}
  const alerts=st.rows.filter(r=>r.level!==BUDGET_LEVEL.ok).length;
  box.innerHTML=`<div class="card-h"><h2 class="card-t">${t('sum.budget.title')}</h2><div class="help flush">${alerts?t('sum.budget.spentOfAlerts',{spent:f2(st.spent),budget:f2(st.budget),count:alerts}):t('sum.budget.spentOf',{spent:f2(st.spent),budget:f2(st.budget)})}</div></div>
    <div class="bud-list">${st.rows.map(r=>`<div class="bud-row tap" data-go="cat" data-c="${esc(r.group)}" data-m="${ui.cur}" role="button" tabindex="0" aria-label="${t('sum.budget.rowAria',{group:esc(displayName(r.group)),spent:f2(r.spent),budget:f2(r.budget)})}">
      <div class="bud-top"><span class="bud-n">${groupIcon(r.group)} ${esc(displayName(r.group))}</span><span class="bud-v"><b>${f2(r.spent)}</b> <span class="mut">/ ${f0(r.budget)}</span></span></div>
      ${progressBar(r.share,r.level,esc(displayName(r.group)))}
      <div class="bud-s">${budgetLine(r,inProgress)}</div></div>`).join('')}</div>
    <div class="help flush bud-foot">${t('sum.budget.foot')}</div>`;
}

/**
 * ui/views/budget-card.js
 * Responsibility: Summary tab card "Orçamento do mês": each group with a budget, how much was
 * spent, what is left and a warning near/over the limit (rules in domain/budgets.js).
 * Tap a group to open its detail; budgets are set in the Categorias tab.
 */
import { $, esc } from '../../core/dom.js';
import { f0, f2 } from '../../core/format.js';
import { mOf, today } from '../../core/dates.js';
import { BUDGET_LEVEL, budgetStatus } from '../../domain/budgets.js';
import { groupIcon } from '../../domain/category-groups.js';
import { ui } from '../ui-state.js';
import { progressBar } from '../components/progress-bar.js';
const percent=x=>Math.round(x*100)+'%';
// the short line under each group
export function budgetLine(r,inProgress){
  if(r.level===BUDGET_LEVEL.over)return `<span class="neg">Estourou ${f2(-r.remaining)}</span> · ${percent(r.share)} do orçamento`;
  const left=`Faltam ${f2(r.remaining)} · ${percent(r.share)} usado`;
  if(inProgress&&r.onPaceToExceed)return `${left} · <span class="warn-t">no ritmo atual fecha em ${f0(r.projected)}</span>`;
  if(r.level===BUDGET_LEVEL.near)return `<span class="warn-t">Perto do limite</span> · ${left}`;
  return left;
}
export function renderBudgets(){
  const box=$('budgetCard'),st=budgetStatus(ui.cur),inProgress=ui.cur===mOf(today());
  if(!st.rows.length){
    box.innerHTML=`<div class="card-h"><h2 class="card-t">Orçamento do mês</h2></div>
      <div class="help flush">Defina quanto quer gastar por mês em cada grupo (ex.: Moradia até R$ 1.100) e acompanhe aqui, com aviso perto do limite.</div>
      <button type="button" class="btn sm bud-set" data-go="tab" data-t="cad">Definir orçamentos</button>`;
    return;}
  const alerts=st.rows.filter(r=>r.level!==BUDGET_LEVEL.ok).length;
  box.innerHTML=`<div class="card-h"><h2 class="card-t">Orçamento do mês</h2><div class="help flush">${f2(st.spent)} de ${f2(st.budget)}${alerts?` · <span class="warn-t">${alerts} grupo(s) no limite</span>`:''}</div></div>
    <div class="bud-list">${st.rows.map(r=>`<div class="bud-row tap" data-go="cat" data-c="${esc(r.group)}" data-m="${ui.cur}" role="button" tabindex="0" aria-label="${esc(r.group)}: ${f2(r.spent)} de ${f2(r.budget)}">
      <div class="bud-top"><span class="bud-n">${groupIcon(r.group)} ${esc(r.group)}</span><span class="bud-v"><b>${f2(r.spent)}</b> <span class="mut">/ ${f0(r.budget)}</span></span></div>
      ${progressBar(r.share,r.level,esc(r.group))}
      <div class="bud-s">${budgetLine(r,inProgress)}</div></div>`).join('')}</div>
    <div class="help flush bud-foot">Toque num grupo para ver os lançamentos. Ajuste os valores na aba <button type="button" class="link-btn" data-go="tab" data-t="cad">Categorias</button>.</div>`;
}

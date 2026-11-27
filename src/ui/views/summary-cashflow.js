/**
 * ui/views/summary-cashflow.js
 * Responsibility: Summary tab: month labels, the income / expenses / invested KPIs and spending by group.
 */
import { $, esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { f2, pc } from '../../core/format.js';
import { mIdx, mKey, mLabel, mOf, today } from '../../core/dates.js';
import { groupIcon } from '../../domain/category-groups.js';
import { groupMonth, groupParts, partsText } from '../../domain/spending.js';
import { monthSummary } from '../../domain/month-summary.js';
import { ui } from '../ui-state.js';
import { kpi } from './kpi.js';
// what a group is made of, under its name ("Telefone" under Moradia): the phone bill must not look like rent
const partsLabel=(list,group)=>{const t=partsText(list,group);return t?`<small class="cr-sub" data-smoke="group-parts">${esc(t)}</small>`:'';};
export function renderFlow(){
  ['mLab1','mLab2','mLab4'].forEach(id=>{const el=$(id);if(el)el.textContent=mLabel(ui.cur);});
  document.querySelectorAll('[data-mtoday]').forEach(b=>b.hidden=ui.cur===mOf(today()));
  const sm=monthSummary(ui.cur),rec=sm.income.total,des=sm.expenses.total,apo=sm.contributions.total,v=sm.voucher;
  // "left" is the hero (summary-hero.js); here only what came in, what went out and what was invested
  $('kFlow').innerHTML=
    kpi('rec','➕',t('sum.common.income'),'+ '+f2(rec),t('sum.cashflow.cameIn'),'','income')+
    kpi('des','➖',t('sum.common.expenses'),'− '+f2(des),rec?t('sum.cashflow.ofIncome',{percent:pc(des/rec)}):t('sum.cashflow.monthSpending'),'','expenses')+
    kpi('apo','📈',t('sum.cashflow.invested'),'→ '+f2(apo),rec?t('sum.cashflow.ofIncome',{percent:pc(apo/rec)}):t('sum.cashflow.sentToInvestments'),'','contrib')+
    (v.total||v.inMonth||v.outMonth?kpi('','💰',t('sum.common.voucherBalance'),f2(v.total),t('sum.cashflow.voucherSub',{received:f2(v.inMonth),spent:f2(v.outMonth)}),'','voucher'):'');
  // spending by group (Moradia = condomínio + luz + água...; same totals as the analysis and the group detail)
  const cats=groupMonth(ui.cur),pcats=groupMonth(mKey(mIdx(ui.cur)-1)),parts=groupParts(ui.cur);
  const arr=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  $('cats').innerHTML=arr.length?arr.map(([c,v])=>{const p=pcats[c];let d='<span class="mut">—</span>';
      if(p){const dl=(v-p)/p;d=`<span class="${dl>0?'neg':'pos'}">${dl>0?'▲':'▼'} ${Math.abs(Math.round(dl*100))}%</span>`;}
      return `<div class="catrow tap" data-go="cat" data-c="${esc(c)}" data-m="${ui.cur}" role="button" tabindex="0" aria-label="${t('sum.cashflow.catAria',{group:esc(displayName(c)),value:f2(v)})}"><div class="cr-n">${groupIcon(c)} ${esc(displayName(c))}${partsLabel(parts[c],c)}</div><div class="catbar"><div style="width:${v/arr[0][1]*100}%"></div></div><div class="r fw7">${f2(v)}</div><div class="r fs125" title="${t('sum.cashflow.vsPrevious')}">${d}</div></div>`;}).join('')
    :`<div class="empty">${t('sum.cashflow.noExpenses')}</div>`;
}

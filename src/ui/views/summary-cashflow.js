/**
 * ui/views/summary-cashflow.js
 * Responsibility: Summary tab: month labels, the income / expenses / invested KPIs and spending by group.
 */
import { $, esc } from '../../core/dom.js';
import { f2, pc } from '../../core/format.js';
import { mIdx, mKey, mLabel, mOf, today } from '../../core/dates.js';
import { groupIcon } from '../../domain/category-groups.js';
import { groupMonth } from '../../domain/spending.js';
import { monthSummary } from '../../domain/month-summary.js';
import { ui } from '../ui-state.js';
import { kpi } from './kpi.js';
export function renderFlow(){
  ['mLab1','mLab2','mLab4'].forEach(id=>{const el=$(id);if(el)el.textContent=mLabel(ui.cur);});
  document.querySelectorAll('[data-mtoday]').forEach(b=>b.hidden=ui.cur===mOf(today()));
  const sm=monthSummary(ui.cur),rec=sm.income.total,des=sm.expenses.total,apo=sm.contributions.total,v=sm.voucher;
  // "left" is the hero (summary-hero.js); here only what came in, what went out and what was invested
  $('kFlow').innerHTML=
    kpi('rec','➕','Receitas','+ '+f2(rec),'Entrou no mês','','income')+
    kpi('des','➖','Despesas','− '+f2(des),rec?`${pc(des/rec)} do que entrou`:'Gastos do mês','','expenses')+
    kpi('apo','📈','Investido','→ '+f2(apo),rec?`${pc(apo/rec)} do que entrou`:'Dinheiro enviado aos investimentos','','contrib')+
    (v.total||v.inMonth||v.outMonth?kpi('','💰','Saldo VR/VA',f2(v.total),`Recebido ${f2(v.inMonth)} · gasto ${f2(v.outMonth)} no mês`,'','voucher'):'');
  // spending by group (Moradia = condomínio + luz + água...; same totals as the analysis and the group detail)
  const cats=groupMonth(ui.cur),pcats=groupMonth(mKey(mIdx(ui.cur)-1));
  const arr=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  $('cats').innerHTML=arr.length?arr.map(([c,v])=>{const p=pcats[c];let d='<span class="mut">—</span>';
      if(p){const dl=(v-p)/p;d=`<span class="${dl>0?'neg':'pos'}">${dl>0?'▲':'▼'} ${Math.abs(Math.round(dl*100))}%</span>`;}
      return `<div class="catrow tap" data-go="cat" data-c="${esc(c)}" data-m="${ui.cur}" role="button" tabindex="0" aria-label="${esc(c)}: ${f2(v)}. Ver lançamentos"><div class="cr-n">${groupIcon(c)} ${esc(c)}</div><div class="catbar"><div style="width:${v/arr[0][1]*100}%"></div></div><div class="r fw7">${f2(v)}</div><div class="r fs125" title="vs mês anterior">${d}</div></div>`;}).join('')
    :'<div class="empty">Nenhuma despesa neste mês.<br>Toque em “+” para adicionar.</div>';
}

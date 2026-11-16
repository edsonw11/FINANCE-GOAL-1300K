/**
 * ui/views/summary-cashflow.js
 * Responsibility: Summary tab: month KPIs, income x expenses x contributions chart and spending by category.
 */
import { $, css, esc } from '../../core/dom.js';
import { f2, pc } from '../../core/format.js';
import { mIdx, mKey, mLabel, mOf, mShort, today } from '../../core/dates.js';
import { groupIcon } from '../../domain/category-groups.js';
import { groupMonth } from '../../domain/spending.js';
import { monthSummary } from '../../domain/month-summary.js';
import { ui } from '../ui-state.js';
import { chartWidth, rr } from '../charts/chart-utils.js';
import { kpi } from './kpi.js';
export function renderFlow(){
  ['mLab1','mLab2','mLab3'].forEach(id=>$(id).textContent=mLabel(ui.cur));
  document.querySelectorAll('[data-mtoday]').forEach(b=>b.hidden=ui.cur===mOf(today()));
  const sm=monthSummary(ui.cur),rec=sm.income.total,des=sm.expenses.total,apo=sm.contributions.total,sob=sm.cash.total,v=sm.voucher;
  $('kFlow').innerHTML=
    kpi('rec','➕','Receitas','+ '+f2(rec),'Entradas do mês','','income')+
    kpi('des','➖','Despesas','− '+f2(des),rec?`${pc(des/rec)} das receitas`:'Gastos do mês','','expenses')+
    kpi('apo','🏦','Aportes (investido)','→ '+f2(apo),rec?`${pc(apo/rec)} das receitas`:'Dinheiro enviado aos investimentos','','contrib')+
    kpi('','🧮','Sobrou no caixa',`<span class="${sob>=0?'pos':'neg'}">${sob<0?'−':''}${f2(Math.abs(sob))}</span>`,'Receitas − saídas da conta − faturas pagas − aportes','','cash')+
    kpi('des','💳','Fatura em aberto',f2(sm.openCard.total),`Compras no mês: ${f2(sm.cardBought)} · fatura paga: ${f2(sm.invoicesPaid)}`,'','opencard')+
    kpi('','💰','Saldo VR/VA',f2(v.total),`Recebido ${f2(v.inMonth)} · gasto ${f2(v.outMonth)} no mês`,'','voucher');
  // 6 months
  const idx=mIdx(ui.cur),ms=[];for(let i=idx-5;i<=idx;i++)ms.push(mKey(i));
  const data=ms.map(m=>{const x=monthSummary(m);return [x.income.total,x.expenses.total,x.contributions.total];});
  const mx=Math.max(1000,...data.flat())*1.15,W=chartWidth($('chFlow'),560,240),H=270,L=48,B=30,T=20,pw=W-L-8,ph=H-T-B,gw=pw/6,bw=gw*0.24;
  const col=['--rec','--des','--apo'],nm=['Receitas','Despesas','Aportes'];
  let s='';
  for(let k=0;k<=4;k++){const v=mx/4*k,yy=T+ph-v/mx*ph;s+=`<line x1="${L}" x2="${W-8}" y1="${yy}" y2="${yy}" stroke="${css('--line')}"/><text x="${L-6}" y="${yy+4}" text-anchor="end" font-size="11" fill="${css('--muted')}">${v>=1000?(v/1000).toFixed(0)+'k':'0'}</text>`;}
  const narrow=W<460;
  ms.forEach((m,i)=>{const gx=L+i*gw+gw*0.14;
    data[i].forEach((v,k)=>{const h=v/mx*ph,x=gx+k*(bw+3);
      if(v>0)s+=`<path d="${rr(x,T+ph-h,bw,h,3)}" fill="${css(col[k])}"><title>${mLabel(m)} · ${nm[k]}: ${f2(v)}</title></path>`;});
    s+=`<text x="${L+i*gw+gw/2}" y="${H-10}" text-anchor="middle" font-size="12" font-weight="${m===ui.cur?800:400}" fill="${css(m===ui.cur?'--ink':'--ink2')}">${narrow?mShort(m).slice(0,3):mShort(m)}</text>`;});
  const sv=$('chFlow');sv.setAttribute('viewBox',`0 0 ${W} ${H}`);sv.innerHTML=s;
  // spending by group (Moradia = condomínio + luz + água...; same totals as the analysis and the group detail)
  const cats=groupMonth(ui.cur),pcats=groupMonth(mKey(mIdx(ui.cur)-1));
  const arr=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  $('cats').innerHTML=arr.length?arr.map(([c,v])=>{const p=pcats[c];let d='<span class="mut">—</span>';
      if(p){const dl=(v-p)/p;d=`<span class="${dl>0?'neg':'pos'}">${dl>0?'▲':'▼'} ${Math.abs(Math.round(dl*100))}%</span>`;}
      return `<div class="catrow tap" data-go="cat" data-c="${esc(c)}" data-m="${ui.cur}" role="button" tabindex="0" aria-label="${esc(c)}: ${f2(v)}. Ver lançamentos"><div class="cr-n">${groupIcon(c)} ${esc(c)}</div><div class="catbar"><div style="width:${v/arr[0][1]*100}%"></div></div><div class="r fw7">${f2(v)}</div><div class="r fs125" title="vs mês anterior">${d}</div></div>`;}).join('')
    :'<div class="empty">Nenhuma despesa neste mês.<br>Toque em “+” para adicionar.</div>';
}

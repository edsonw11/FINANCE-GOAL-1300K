/**
 * ui/views/credit-card.js
 * Responsibility: Card tab: invoices by cycle and the purchases of each invoice (screen only;
 * the facts come from domain/card-status.js and the changes from domain commands).
 * The look is in styles/08-screens.css.
 */
import { $, esc } from '../../core/dom.js';
import { f2, m2 } from '../../core/format.js';
import { addDay, daysBetween, formatDateBR, mIdx, mKey, monthEnd, today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { txIn } from '../../domain/transactions.js';
import { icon } from '../../domain/categories.js';
import { CARD, closeDateOf, cycleStart, dueDateOf, dueMonth } from '../../domain/card-cycle.js';
import { invoiceItems, invoiceUndetailed, openCard } from '../../domain/card-invoices.js';
import { cycleItems, cycleTotals, invoiceStatus } from '../../domain/card-status.js';
import { classifyUndetailed } from '../../domain/invoice-payment.js';
import { setClosingOverride } from '../../domain/settings-commands.js';
import { ui } from '../ui-state.js';
import { datePicker } from '../components/date-input.js';
import { runCommand } from '../components/command.js';
import { openItem } from './item-dialog.js';
let selectedCycle=null;
export function renderCycles(){
  const t0=today(),fmNow=dueMonth(t0),view=selectedCycle||fmNow;
  const itemsOf=cycleItems,buy=fm=>cycleTotals(fm).bought,paid=fm=>cycleTotals(fm).paid;
  const STATUS_TAG={paid:()=>'<span class="tag pay-vr">✔ Paga</span>',open:()=>'<span class="tag pay-cartao">Aberta</span>',
    closed:st=>'<span class="tag fatura">Fechada · vence em '+st.days+' dia(s)</span>',late:()=>'<span class="tag despesa">⚠ Vencida, sem pagamento lançado</span>'};
  const stOf=fm=>{const st=invoiceStatus(fm,t0);return STATUS_TAG[st.code](st);};
  // invoices table: click a row to filter the list below
  let rows='<tr><th>Fatura (vence em)</th><th>Compras de</th><th>Fecha em (ajustável)</th><th class="r">Lançado</th><th class="r">Pago</th><th>Situação</th></tr>';
  for(let i=-1;i<=3;i++){const fm=mKey(mIdx(fmNow)+i),p2=paid(fm),cdt=closeDateOf(fm);
    rows+=`<tr data-cyc="${fm}" class="cyc-row${fm===view?' on':''}" title="Clique para ver as compras desta fatura"><td><b>${formatDateBR(dueDateOf(fm))}</b>${fm===fmNow?' <span class="mut fs12">· atual</span>':''}</td><td>${formatDateBR(cycleStart(fm))}</td><td><input type="date" data-over="${fm}" value="${cdt}" class="ci w-150" title="Ajuste se o banco mostrar outra data"></td><td class="r">${f2(buy(fm))}</td><td class="r">${p2?f2(p2):'—'}</td><td>${stOf(fm)}</td></tr>`;}
  const tableCard=`<details class="card mb-14 inv-all"${ui.allInvoicesOpen?' open':''}><summary class="card-title">Todas as faturas e fechamento <span class="mut title-note">· melhor dia de compra: dia ${CARD().best} · vence dia ${CARD().due}</span></summary><div class="scroll"><table class="tl stack">${rows}</table></div></details>`;
  // details of the selected invoice
  const dd=dueDateOf(view),cd=closeDateOf(view),st=cycleStart(view),its=itemsOf(view),tot=buy(view),left=daysBetween(t0,cd),nextFm=mKey(mIdx(view)+1);
  const rel=view===fmNow?'Fatura atual':mIdx(view)>mIdx(fmNow)?'Próxima fatura':'Fatura anterior';
  const deadline=t0<=cd?`<div class="cc-deadline">⏳ <b>Último dia para comprar nesta fatura: ${formatDateBR(cd)}</b> · ${left>0?'faltam '+left+' dia(s)':'é hoje'}. A partir de ${formatDateBR(addDay(cd,1))} as compras vão para a fatura de ${formatDateBR(dueDateOf(nextFm))}.</div>`:`<div class="help mt-6">Fatura fechada em ${formatDateBR(cd)}.</div>`;
  const body=its.length?`<tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="r">Valor</th><th></th></tr>`+its.map(t=>`<tr data-tx="${t.id}" class="rowclick" tabindex="0" role="button"><td>${formatDateBR(t.date)}</td><td>${icon('despesa',t.cat)} ${esc(t.cat)}</td><td class="mut">${esc(t.desc||'')}</td><td class="r">${f2(t.value)}</td><td class="r nw"><button class="btn sm" data-ie="${t.id}">Editar</button></td></tr>`).join('')+`<tr class="tr-total"><td colspan="3"><b>Total da fatura</b></td><td class="r"><b>${f2(tot)}</b></td><td></td></tr>`:'<tr><td class="empty" colspan="5">Nenhuma compra de cartão lançada nesta fatura ainda.</td></tr>';
  const detail=`<div class="card mb-14 cc-detail">
    <div class="cc-head"><div class="cc-label">${rel} · vence em ${formatDateBR(dd)}</div>${stOf(view)}</div>
    <div class="cc-amount">${f2(tot)}</div>
    <div class="cc-sub">${its.length} compra(s) de ${formatDateBR(st)} até ${formatDateBR(cd)}</div>
    ${deadline}
    <div class="scroll mt-12"><table class="tl stack">${body}</table></div>
    <div class="mt-12"><button class="btn pri" id="cycAdd">+ Adicionar compra nesta fatura</button></div>
  </div>`;
  $('cycleBox').innerHTML=detail+tableCard;
  $('cycleBox').querySelector('.inv-all').ontoggle=e=>{ui.allInvoicesOpen=e.target.open;};
  document.querySelectorAll('tr[data-cyc]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('input'))return;selectedCycle=tr.dataset.cyc;renderCycles();});
  document.querySelectorAll('[data-over]').forEach(el=>datePicker(el));
  document.querySelectorAll('[data-over]').forEach(el=>el.onchange=()=>runCommand(()=>setClosingOverride(el.dataset.over,el.value),{ok:'Fechamento ajustado'}));
  document.querySelectorAll('[data-ie]').forEach(el=>el.onclick=e=>{e.stopPropagation();openItem(+el.dataset.ie);});
  $('cycAdd').onclick=()=>openItem(null,t0>=st&&t0<=cd?t0:(t0<st?st:cd));
}
export function renderCardBox(){
  const fs=txIn(ui.cur,'fatura').sort((a,b)=>a.date.localeCompare(b.date)),open=openCard(monthEnd(ui.cur)).sort((a,b)=>a.date.localeCompare(b.date));
  const row=(d,c,desc,v,warn)=>`<tr${warn?' class="warn-row"':''}><td>${d}</td><td>${c}</td><td class="mut">${desc}</td><td class="r">${f2(v)}</td></tr>`;
  const head='<tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="r">Valor</th></tr>';
  const itemRow=t=>row(formatDateBR(t.date),icon('despesa',t.cat)+' '+esc(t.cat),esc(t.desc||''),t.value);
  let h='';
  fs.forEach(f=>{const its=invoiceItems(f),u=invoiceUndetailed(f);
    h+=`<div class="cc-paid"><div class="cc-paid-h"><span>💳 Fatura paga em ${formatDateBR(f.date)}${f.desc?' · '+esc(f.desc):''}</span><span>${f2(f.value)}</span></div><div class="scroll"><table class="tl stack">${head}${its.map(itemRow).join('')}${u>0?row('—','❓ Sem descrição','Gasto no cartão que você ainda não lançou (ex.: Uber)',u,true):''}</table></div>${u>0?`<div class="row cc-classify"><div class="f f2"><label>Classificar o que sobrou · categoria</label><input list="catListD" data-clc="${f.id}" placeholder="Ex.: Transporte"></div><div class="f f2"><label>Descrição</label><input data-cld="${f.id}" placeholder="Ex.: Uber"></div><div class="f"><label>Valor</label><input data-clv="${f.id}" data-money value="${m2(u)}"></div><button class="btn sm pri h-42" data-cls="${f.id}">Classificar</button></div>`:''}</div>`;});
  if(!h)h='<div class="empty">Nenhuma fatura paga neste mês. As compras de cada fatura aparecem acima.</div>';
  $('cardBox').innerHTML=h;
  const cs=new Set(((S.cats||{}).despesa||[]).filter(c=>!c.off).map(c=>c.name));
  $('catListD').innerHTML=[...cs].map(c=>`<option value="${esc(c)}">`).join('');
  document.querySelectorAll('[data-cls]').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.cls,val=k=>document.querySelector(`[data-${k}="${id}"]`).value;
    const input={cat:val('clc'),desc:val('cld'),value:parseMoney(val('clv'))};
    runCommand(()=>classifyUndetailed(id,input),{ok:()=>'✅ '+f2(input.value)+' classificado como '+input.cat.trim()});});
}

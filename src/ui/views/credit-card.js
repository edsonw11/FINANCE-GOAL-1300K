/**
 * ui/views/credit-card.js
 * Responsibility: Card tab: the selected invoice (arrows ‹ › move between invoices), its purchases
 * as list rows, the closing dates of every invoice, and the payments of the selected invoice
 * (card-paid.js). Screen only: the facts come from domain/card-status.js and the changes from
 * domain commands. The look is in styles/08-screens.css.
 */
import { $ } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { addDay, daysBetween, formatDateBR, mIdx, mKey, today } from '../../core/dates.js';
import { CARD, closeDateOf, cycleStart, dueDateOf, dueMonth } from '../../domain/card-cycle.js';
import { cycleItems, cycleTotals, invoiceStatus } from '../../domain/card-status.js';
import { setClosingOverride } from '../../domain/settings-commands.js';
import { ui } from '../ui-state.js';
import { datePicker } from '../components/date-input.js';
import { runCommand } from '../components/command.js';
import { txRow } from '../components/breakdown.js';
import { invoiceName } from '../invoice-name.js';
import { openItem } from './item-dialog.js';
import { renderPaidInvoices } from './card-paid.js';
const STATUS_TAG={paid:()=>'<span class="tag pay-vr">✔ Paga</span>',open:()=>'<span class="tag pay-cartao">Aberta</span>',
  closed:st=>'<span class="tag fatura">Fechada · vence em '+st.days+' dia(s)</span>',late:()=>'<span class="tag despesa">⚠ Vencida, sem pagamento lançado</span>'};
const NEAR=[-1,0,1,2,3]; // invoices listed in the table, around the current one
let selectedCycle=null;
const statusTag=(fm,t0)=>{const st=invoiceStatus(fm,t0);return STATUS_TAG[st.code](st);};
// table of every invoice: tap a row to select it, change the closing date when the bank shows another one
function invoicesTable(view,fmNow,t0){
  let rows='<tr><th>Fatura</th><th>Compras de</th><th>Fecha em (ajustável)</th><th class="r">Lançado</th><th class="r">Pago</th><th>Situação</th></tr>';
  NEAR.forEach(i=>{const fm=mKey(mIdx(fmNow)+i),tot=cycleTotals(fm);
    rows+=`<tr data-cyc="${fm}" class="cyc-row${fm===view?' on':''}" title="Clique para ver as compras desta fatura"><td data-label="Fatura"><b>${invoiceName(fm)}</b>${fm===fmNow?' <span class="mut fs12">· atual</span>':''}</td><td data-label="Compras de">${formatDateBR(cycleStart(fm))}</td><td data-label="Fecha em"><input type="date" data-over="${fm}" value="${closeDateOf(fm)}" class="ci w-150" title="Ajuste se o banco mostrar outra data"></td><td class="r" data-label="Lançado">${f2(tot.bought)}</td><td class="r" data-label="Pago">${tot.paid?f2(tot.paid):'—'}</td><td data-label="Situação">${statusTag(fm,t0)}</td></tr>`;});
  return `<details class="card mb-14 inv-all"${ui.allInvoicesOpen?' open':''}><summary class="card-title">Todas as faturas e fechamento <span class="mut title-note">· melhor dia de compra: dia ${CARD().best} · vence dia ${CARD().due}</span></summary><div class="scroll"><table class="tl stack">${rows}</table></div></details>`;
}
function invoiceCard(view,fmNow,t0){
  const cd=closeDateOf(view),st=cycleStart(view),its=cycleItems(view),tot=cycleTotals(view).bought,left=daysBetween(t0,cd);
  const rel=view===fmNow?'atual':mIdx(view)>mIdx(fmNow)?'próxima':'anterior';
  const deadline=t0<=cd?`<div class="cc-deadline">⏳ <b>Último dia para comprar nesta fatura: ${formatDateBR(cd)}</b> · ${left>0?'faltam '+left+' dia(s)':'é hoje'}. A partir de ${formatDateBR(addDay(cd,1))} as compras vão para a ${invoiceName(mKey(mIdx(view)+1))}.</div>`:`<div class="help mt-6">Fatura fechada em ${formatDateBR(cd)}.</div>`;
  const list=its.length?`<div class="lst mt-12">${its.map(t=>txRow(t,{sign:''})).join('')}</div><div class="cc-total"><span>Total da fatura</span><b>${f2(tot)}</b></div>`
    :'<div class="empty sm mt-12">Nenhuma compra de cartão lançada nesta fatura ainda.</div>';
  return `<div class="card mb-14 cc-detail">
    <div class="cc-nav"><button type="button" class="btn sm" data-cyc-mv="-1" aria-label="Fatura anterior">‹</button>
      <div class="cc-name" aria-live="polite"><b>${invoiceName(view)}</b><span class="mut"> · ${rel}</span></div>
      <button type="button" class="btn sm" data-cyc-mv="1" aria-label="Próxima fatura">›</button>${view!==fmNow?'<button type="button" class="btn sm" data-cyc-now>Atual</button>':''}</div>
    <div class="cc-head"><div class="cc-label">Vence em ${formatDateBR(dueDateOf(view))}</div>${statusTag(view,t0)}</div>
    <div class="cc-amount">${f2(tot)}</div>
    <div class="cc-sub">${its.length} compra(s) de ${formatDateBR(st)} até ${formatDateBR(cd)}</div>
    ${deadline}${list}<div id="ccPaidNote"></div>
    <div class="mt-12"><button class="btn pri" id="cycAdd">+ Adicionar compra nesta fatura</button></div>
  </div>`;
}
function selectCycle(fm){selectedCycle=fm;renderCycles();}
export function renderCycles(){
  const t0=today(),fmNow=dueMonth(t0),view=selectedCycle||fmNow,st=cycleStart(view),cd=closeDateOf(view);
  $('cycleBox').innerHTML=invoiceCard(view,fmNow,t0)+invoicesTable(view,fmNow,t0);
  const paid=renderPaidInvoices(view);
  $('ccPaidNote').innerHTML=paid?'':'<div class="help mt-6">Nenhum pagamento lançado para esta fatura.</div>';
  $('cycleBox').querySelector('.inv-all').ontoggle=e=>{ui.allInvoicesOpen=e.target.open;};
  $('cycleBox').querySelectorAll('[data-cyc-mv]').forEach(b=>b.onclick=()=>selectCycle(mKey(mIdx(view)+(+b.dataset.cycMv))));
  const now=$('cycleBox').querySelector('[data-cyc-now]');if(now)now.onclick=()=>selectCycle(fmNow);
  $('cycleBox').querySelectorAll('tr[data-cyc]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('input'))return;selectCycle(tr.dataset.cyc);});
  $('cycleBox').querySelectorAll('[data-over]').forEach(el=>{datePicker(el);
    el.onchange=()=>runCommand(()=>setClosingOverride(el.dataset.over,el.value),{ok:'Fechamento ajustado'});});
  $('cycAdd').onclick=()=>openItem(null,t0>=st&&t0<=cd?t0:(t0<st?st:cd));
}

/**
 * ui/views/credit-card.js
 * Responsibility: Card tab: the selected invoice (arrows ‹ › move between invoices), its purchases
 * as list rows, the closing dates of every invoice, and the payments of the selected invoice
 * (card-paid.js). Screen only: the facts come from domain/card-status.js and the changes from
 * domain commands. The look is in styles/08-screens.css.
 */
import { t } from '../../core/i18n.js';
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
const STATUS_TAG={paid:()=>`<span class="tag pay-vr">${t('tx.card.statusPaid')}</span>`,open:()=>`<span class="tag pay-cartao">${t('tx.card.statusOpen')}</span>`,
  closed:st=>`<span class="tag fatura">${t('tx.card.statusClosed',{count:st.days})}</span>`,late:()=>`<span class="tag despesa">${t('tx.card.statusLate')}</span>`};
const NEAR=[-1,0,1,2,3]; // invoices listed in the table, around the current one
let selectedCycle=null;
const statusTag=(fm,t0)=>{const st=invoiceStatus(fm,t0);return STATUS_TAG[st.code](st);};
// table of every invoice: tap a row to select it, change the closing date when the bank shows another one
function invoicesTable(view,fmNow,t0){
  let rows=`<tr><th>${t('tx.field.invoice')}</th><th>${t('tx.card.colPurchasesFrom')}</th><th>${t('tx.card.colClosesAdj')}</th><th class="r">${t('tx.card.colLaunched')}</th><th class="r">${t('tx.card.colPaid')}</th><th>${t('tx.card.colStatus')}</th></tr>`;
  NEAR.forEach(i=>{const fm=mKey(mIdx(fmNow)+i),tot=cycleTotals(fm);
    rows+=`<tr data-cyc="${fm}" class="cyc-row${fm===view?' on':''}" title="${t('tx.card.rowTitle')}"><td data-label="${t('tx.field.invoice')}"><b>${invoiceName(fm)}</b>${fm===fmNow?` <span class="mut fs12">· ${t('tx.card.relCurrent')}</span>`:''}</td><td data-label="${t('tx.card.colPurchasesFrom')}">${formatDateBR(cycleStart(fm))}</td><td data-label="${t('tx.card.colCloses')}"><input type="date" data-over="${fm}" value="${closeDateOf(fm)}" class="ci w-150" title="${t('tx.card.overrideTitle')}"></td><td class="r" data-label="${t('tx.card.colLaunched')}">${f2(tot.bought)}</td><td class="r" data-label="${t('tx.card.colPaid')}">${tot.paid?f2(tot.paid):'—'}</td><td data-label="${t('tx.card.colStatus')}">${statusTag(fm,t0)}</td></tr>`;});
  return `<details class="card mb-14 inv-all"${ui.allInvoicesOpen?' open':''}><summary class="card-title">${t('tx.card.allInvoices')} <span class="mut title-note">${t('tx.card.cycleNote',{best:CARD().best,due:CARD().due})}</span></summary><div class="scroll"><table class="tl stack">${rows}</table></div></details>`;
}
function invoiceCard(view,fmNow,t0){
  const cd=closeDateOf(view),st=cycleStart(view),its=cycleItems(view),tot=cycleTotals(view).bought,left=daysBetween(t0,cd);
  const rel=view===fmNow?t('tx.card.relCurrent'):mIdx(view)>mIdx(fmNow)?t('tx.card.relNext'):t('tx.card.relPrev');
  const deadline=t0<=cd?`<div class="cc-deadline">${t(left>0?'tx.card.deadlineLeft':'tx.card.deadlineToday',{date:formatDateBR(cd),count:left,next:formatDateBR(addDay(cd,1)),name:invoiceName(mKey(mIdx(view)+1))})}</div>`:`<div class="help mt-6">${t('tx.card.closedOn',{date:formatDateBR(cd)})}</div>`;
  const list=its.length?`<div class="lst mt-12">${its.map(t=>txRow(t,{sign:''})).join('')}</div><div class="cc-total"><span>${t('tx.card.total')}</span><b>${f2(tot)}</b></div>`
    :`<div class="empty sm mt-12">${t('tx.card.noPurchases')}</div>`;
  return `<div class="card mb-14 cc-detail">
    <div class="cc-nav"><button type="button" class="btn sm" data-cyc-mv="-1" aria-label="${t('tx.card.prevInvoice')}">‹</button>
      <div class="cc-name" aria-live="polite"><b>${invoiceName(view)}</b><span class="mut"> · ${rel}</span></div>
      <button type="button" class="btn sm" data-cyc-mv="1" aria-label="${t('tx.card.nextInvoice')}">›</button>${view!==fmNow?`<button type="button" class="btn sm" data-cyc-now>${t('tx.card.btnNow')}</button>`:''}</div>
    <div class="cc-head"><div class="cc-label">${t('tx.card.dueOn',{date:formatDateBR(dueDateOf(view))})}</div>${statusTag(view,t0)}</div>
    <div class="cc-amount">${f2(tot)}</div>
    <div class="cc-sub">${t('tx.card.purchasesRange',{count:its.length,from:formatDateBR(st),to:formatDateBR(cd)})}</div>
    ${deadline}${list}<div id="ccPaidNote"></div>
    <div class="mt-12"><button class="btn pri" id="cycAdd">${t('tx.card.addPurchase')}</button></div>
  </div>`;
}
function selectCycle(fm){selectedCycle=fm;renderCycles();}
export function renderCycles(){
  const t0=today(),fmNow=dueMonth(t0),view=selectedCycle||fmNow,st=cycleStart(view),cd=closeDateOf(view);
  $('cycleBox').innerHTML=invoiceCard(view,fmNow,t0)+invoicesTable(view,fmNow,t0);
  const paid=renderPaidInvoices(view);
  $('ccPaidNote').innerHTML=paid?'':`<div class="help mt-6">${t('tx.card.noPayments')}</div>`;
  $('cycleBox').querySelector('.inv-all').ontoggle=e=>{ui.allInvoicesOpen=e.target.open;};
  $('cycleBox').querySelectorAll('[data-cyc-mv]').forEach(b=>b.onclick=()=>selectCycle(mKey(mIdx(view)+(+b.dataset.cycMv))));
  const now=$('cycleBox').querySelector('[data-cyc-now]');if(now)now.onclick=()=>selectCycle(fmNow);
  $('cycleBox').querySelectorAll('tr[data-cyc]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('input'))return;selectCycle(tr.dataset.cyc);});
  $('cycleBox').querySelectorAll('[data-over]').forEach(el=>{datePicker(el);
    el.onchange=()=>runCommand(()=>setClosingOverride(el.dataset.over,el.value),{ok:t('tx.card.closingAdjusted')});});
  $('cycAdd').onclick=()=>openItem(null,t0>=st&&t0<=cd?t0:(t0<st?st:cd));
}

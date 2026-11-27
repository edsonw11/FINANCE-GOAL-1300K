/**
 * ui/views/card-paid.js
 * Responsibility: Card tab, payments of the selected invoice: what each payment covered and the
 * part still without detail, which can be classified (the change is a domain command).
 */
import { t } from '../../core/i18n.js';
import { displayName, storedName } from '../../core/stored-names.js';
import { $, esc } from '../../core/dom.js';
import { f2, m2 } from '../../core/format.js';
import { formatDateBR } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { invoiceMonthOf } from '../../domain/card-cycle.js';
import { invoiceItems, invoiceUndetailed } from '../../domain/card-invoices.js';
import { classifyUndetailed } from '../../domain/invoice-payment.js';
import { runCommand } from '../components/command.js';
import { infoRow, txRow } from '../components/breakdown.js';
import { chipsBox } from '../components/category-chips.js';
const paymentsOf=fm=>S.tx.filter(t=>t.type==='fatura'&&invoiceMonthOf(t)===fm).sort((a,b)=>a.date.localeCompare(b.date));
function classifyForm(f,u){
  return `<div class="row cc-classify"><div class="f f2"><label>${t('tx.cardPaid.classifyCat')}</label><input list="catListD" data-clc="${f.id}" placeholder="${t('tx.cardPaid.catPh')}">${chipsBox('despesa','')}</div><div class="f f2"><label>${t('tx.field.description')}</label><input data-cld="${f.id}" placeholder="${t('tx.cardPaid.descPh')}"></div><div class="f"><label>${t('tx.field.value')}</label><input data-clv="${f.id}" data-money value="${m2(u)}"></div><button class="btn sm pri h-42" data-cls="${f.id}">${t('tx.cardPaid.classify')}</button></div>`;
}
function paymentBlock(f){
  const its=invoiceItems(f),u=invoiceUndetailed(f);
  const rows=its.map(t=>txRow(t,{sign:''})).join('')+(u>0?infoRow({icon:'❓',title:t('tx.cardPaid.noDescTitle'),sub:t('tx.cardPaid.noDescSub'),value:f2(u),cls:'warn-row'}):'');
  return `<div class="card mb-14 cc-paid"><div class="cc-paid-h"><span>${t('tx.cardPaid.paidOn',{date:formatDateBR(f.date)})}${f.desc?' · '+esc(f.desc):''}</span><span>${f2(f.value)}</span></div>
    <div class="lst">${rows}</div>${u>0?classifyForm(f,u):''}</div>`;
}
// one line inside the invoice card when nothing was paid yet; one card per payment otherwise
export function renderPaidInvoices(fm){
  const fs=paymentsOf(fm);
  $('cardBox').innerHTML=fs.length?`<h2 class="cc-paid-t">${t('tx.cardPaid.title')}</h2>`+fs.map(paymentBlock).join(''):'';
  $('catListD').innerHTML=((S.cats||{}).despesa||[]).filter(c=>!c.off).map(c=>`<option value="${esc(displayName(c.name))}">`).join('');
  document.querySelectorAll('[data-cls]').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.cls,val=k=>document.querySelector(`[data-${k}="${id}"]`).value;
    const input={cat:storedName(val('clc').trim()),desc:val('cld'),value:parseMoney(val('clv'))};
    runCommand(()=>classifyUndetailed(id,input),{ok:()=>t('tx.cardPaid.classified',{amount:f2(input.value),cat:displayName(input.cat)})});});
  return fs.length;
}

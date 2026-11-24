/**
 * ui/views/card-paid.js
 * Responsibility: Card tab, payments of the selected invoice: what each payment covered and the
 * part still without detail, which can be classified (the change is a domain command).
 */
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
const paymentsOf=fm=>S.tx.filter(t=>t.type==='fatura'&&invoiceMonthOf(t)===fm).sort((a,b)=>a.date.localeCompare(b.date));
function classifyForm(f,u){
  return `<div class="row cc-classify"><div class="f f2"><label>Classificar o que sobrou · categoria</label><input list="catListD" data-clc="${f.id}" placeholder="Ex.: Transporte"></div><div class="f f2"><label>Descrição</label><input data-cld="${f.id}" placeholder="Ex.: Uber"></div><div class="f"><label>Valor</label><input data-clv="${f.id}" data-money value="${m2(u)}"></div><button class="btn sm pri h-42" data-cls="${f.id}">Classificar</button></div>`;
}
function paymentBlock(f){
  const its=invoiceItems(f),u=invoiceUndetailed(f);
  const rows=its.map(t=>txRow(t,{sign:''})).join('')+(u>0?infoRow({icon:'❓',title:'Sem descrição',sub:'Gasto no cartão que você ainda não lançou (ex.: Uber)',value:f2(u),cls:'warn-row'}):'');
  return `<div class="card mb-14 cc-paid"><div class="cc-paid-h"><span>💳 Pago em ${formatDateBR(f.date)}${f.desc?' · '+esc(f.desc):''}</span><span>${f2(f.value)}</span></div>
    <div class="lst">${rows}</div>${u>0?classifyForm(f,u):''}</div>`;
}
// one line inside the invoice card when nothing was paid yet; one card per payment otherwise
export function renderPaidInvoices(fm){
  const fs=paymentsOf(fm);
  $('cardBox').innerHTML=fs.length?`<h2 class="cc-paid-t">Pagamentos desta fatura</h2>`+fs.map(paymentBlock).join(''):'';
  $('catListD').innerHTML=((S.cats||{}).despesa||[]).filter(c=>!c.off).map(c=>`<option value="${esc(c.name)}">`).join('');
  document.querySelectorAll('[data-cls]').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.cls,val=k=>document.querySelector(`[data-${k}="${id}"]`).value;
    const input={cat:val('clc'),desc:val('cld'),value:parseMoney(val('clv'))};
    runCommand(()=>classifyUndetailed(id,input),{ok:()=>'✅ '+f2(input.value)+' classificado como '+input.cat.trim()});});
  return fs.length;
}

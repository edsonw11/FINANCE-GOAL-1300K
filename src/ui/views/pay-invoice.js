/**
 * ui/views/pay-invoice.js
 * Responsibility: Pay invoice screen (quick mode): pick the invoice, full or partial amount,
 * confirm and cancel a payment. The amount rule is domain/invoice-payment.js (planPayment).
 * The look is in styles/08-screens.css.
 */
import { UNDETAILED_CAT } from '../../domain/spending.js';
import { displayName } from '../../core/stored-names.js';
import { tt } from '../../core/i18n.js';
import { $, esc } from '../../core/dom.js';
import { f2, m2, sum } from '../../core/format.js';
import { formatDateBR, mOf, today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { deleteTransactions } from '../../domain/transactions.js';
import { icon } from '../../domain/categories.js';
import { closeDateOf, cycleStart, dueDateOf, dueMonth, invoiceMonthOf, nearestDueMonth } from '../../domain/card-cycle.js';
import { payableInvoices, payableItems } from '../../domain/card-invoices.js';
import { payInvoice, paymentExcess, planPayment } from '../../domain/invoice-payment.js';
import { ui } from '../ui-state.js';
import { toast } from '../toast.js';
import { askConfirm } from '../components/confirm.js';
import { fieldError } from '../components/field-error.js';
import { runCommand } from '../components/command.js';
import { render } from '../render.js';
import { fillCategoryOptions } from './transaction-form.js';
import { drawInvoiceForm, initInvoiceForm } from './invoice-form.js';
import { openItem } from './item-dialog.js';
import { invoiceName } from '../invoice-name.js';
// ---- pay invoice (quick mode): pick the invoice and the amount, no date/description ----
let payMode='total';
export const isQuickPay=()=>ui.type==='fatura'&&ui.editId===null&&!ui.payAdvanced;
let payOpen=null,payIds=null,payIdsFm=null;
export async function cancelPay(t){
  const r=await askConfirm({title:tt('tx.pay.cancelTitle'),ok:tt('tx.pay.cancelBtn'),danger:true,
    html:tt('tx.pay.cancelHtml',{due:formatDateBR(dueDateOf(invoiceMonthOf(t))),amount:f2(t.value),paid:formatDateBR(t.date)})});
  if(!r)return false;
  if(!runCommand(()=>deleteTransactions([t.id]),{render:false}))return false;
  payIds=null;render();toast(tt('tx.pay.cancelled'));return true;}
function paidInvoicesList(){
  const ps=S.tx.filter(t=>t.type==='fatura').sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,5);
  if(!ps.length)return '';
  return `<div class="pay-paid"><div class="pay-paid-h">${tt('tx.pay.registeredHtml')}</div>`+
    ps.map(t=>`<div class="pay-line"><span class="pay-line-t">💳 ${invoiceName(invoiceMonthOf(t))} <span class="mut">${tt('tx.pay.paidOn',{date:formatDateBR(t.date)})}</span></span><b>${f2(t.value)}</b><button type="button" class="btn sm dng" data-cp="${t.id}">${tt('tx.pay.cancelBtn')}</button></div>`).join('')+'</div>';}
function bindPaidInvoices(box){box.querySelectorAll('[data-cp]').forEach(b=>b.onclick=()=>{const t=S.tx.find(x=>x.id===+b.dataset.cp);if(t)cancelPay(t);});}
export function renderPay(){
  const L=payableInvoices(),box=$('payBox'),t0=today();
  if(!L.length){box.innerHTML=`<div class="empty pay-empty">${tt('tx.pay.none')}</div><div class="tc"><button type="button" class="btn sm" id="payAdv">${tt('tx.pay.manual')}</button></div>`+paidInvoicesList();bindPaidInvoices(box);$('payAdv').onclick=()=>{ui.payAdvanced=true;fillCategoryOptions();};return;}
  if(payOpen===null){const nf=nearestDueMonth(t0);payOpen=(L.find(f=>f.fm===nf)||L[0]).fm;}
  if(payOpen&&!L.some(f=>f.fm===payOpen))payOpen=L[0].fm;
  const fmNow=dueMonth(t0),head=L.filter(f=>f.fm<=fmNow),fut=L.filter(f=>f.fm>fmNow);
  const f=L.find(x=>x.fm===payOpen);
  let its=[];
  if(f){its=payableItems(f.fm);if(payIdsFm!==f.fm||!payIds){payIds=new Set(its.map(t=>t.id));payIdsFm=f.fm;}else payIds=new Set([...payIds].filter(id=>its.some(t=>t.id===id)));}
  const selTot=its.length?sum(its.filter(t=>payIds.has(t.id)).map(t=>t.value)):0,all=its.length>0&&payIds.size===its.length;
  // the open invoice: its purchases (check/uncheck), full or partial amount, pay button
  const purchaseLine=t=>`<div class="pay-line"><input type="checkbox" data-pi="${t.id}" ${payIds.has(t.id)?'checked':''} class="w-auto" aria-label="${tt('tx.pay.include')}"><span data-pe="${t.id}" title="${tt('tx.common.clickToEdit')}" class="pay-line-t tap-t">${formatDateBR(t.date)} · ${icon('despesa',t.cat)} ${esc(displayName(t.cat))} <span class="mut">${esc(t.desc||'')}</span> <span class="mut fs12">✎</span></span><b>${f2(t.value)}</b></div>`;
  const body=x=>{
    const amtAll=all||!its.length?x.rest:selTot,total=payMode==='total';
    return `<div class="pay-body">
      <div class="help pay-hint">${tt('tx.pay.hint',{from:formatDateBR(cycleStart(x.fm)),to:formatDateBR(closeDateOf(x.fm))})}</div>
      ${its.length?its.map(purchaseLine).join(''):`<div class="help flush">${tt('tx.pay.noItems')}</div>`}
      <div class="pay-new"><button type="button" class="btn sm" id="payNew">${tt('tx.pay.addForgotten')}</button></div>
      <div class="pay-amount">
      <label class="pay-opt"><input type="radio" name="payM" value="total" ${total?'checked':''} class="w-auto">${tt(all||!its.length?'tx.pay.fullAmount':'tx.pay.markedAmount',{amount:f2(amtAll)})}</label>
      <label class="pay-opt last"><input type="radio" name="payM" value="part" ${total?'':'checked'} class="w-auto">${tt('tx.pay.partial')}</label>
      <div id="payPartW" class="pay-part"${total?' hidden':''}><label for="payVal">${tt('tx.pay.amountLabel')}</label><input id="payVal" data-money placeholder="R$ 0,00"></div>
      <div class="row pay-go"><button type="button" class="btn pri" id="payGo">${tt('tx.pay.go')}</button><span class="help flush">${tt('tx.pay.todayNote',{date:formatDateBR(t0)})}</span></div></div></div>`;};
  // one invoice (accordion item)
  const acc=x=>{const on=x.fm===payOpen,dd=dueDateOf(x.fm),late=dd<t0;
    return `<div class="pay-inv${on?' on':''}"><div data-pa="${x.fm}" class="pay-inv-h"><span class="pay-caret">${on?'▾':'▸'}</span><span class="pay-inv-t"><b>${invoiceName(x.fm)}</b> <span class="mut">${tt('tx.pay.dueOn',{date:formatDateBR(dd)})}</span><br><span class="mut">${tt('tx.pay.purchases',{count:x.n})}${x.paid>0?tt('tx.pay.alreadyPaid',{amount:f2(x.paid)}):''}${late?tt('tx.pay.late'):''}</span></span><b class="pay-inv-v">${f2(x.rest)}</b></div>${on?body(x):''}</div>`;};
  const futOpen=fut.some(x=>x.fm===payOpen);
  box.innerHTML=`<div class="pay-q">${tt('tx.pay.which')}</div>${head.map(acc).join('')||`<div class="help">${tt('tx.pay.noCurrent')}</div>`}
    ${fut.length?`<details id="payFut" ${futOpen?'open':''} class="pay-fut"><summary>${tt('tx.pay.future',{count:fut.length,amount:f2(sum(fut.map(x=>x.rest)))})}</summary><div class="mt-6">${fut.map(acc).join('')}</div></details>`:''}
    ${paidInvoicesList()}
    <div class="mt-12"><button type="button" class="btn sm btn-ghost" id="payAdv">${tt('tx.pay.advanced')}</button></div>`;
  bindPaidInvoices(box);
  box.querySelectorAll('[data-pa]').forEach(el=>el.onclick=()=>{const fm=el.dataset.pa;payOpen=(payOpen===fm)?'':fm;if(payOpen)payIds=null;payMode='total';renderPay();});
  box.querySelectorAll('[data-pi]').forEach(el=>el.onchange=()=>{el.checked?payIds.add(+el.dataset.pi):payIds.delete(+el.dataset.pi);renderPay();});
  box.querySelectorAll('[data-pe]').forEach(el=>el.onclick=()=>openItem(+el.dataset.pe));
  box.querySelectorAll('input[name=payM]').forEach(r=>r.onchange=()=>{payMode=r.value;renderPay();if(payMode==='part')$('payVal').focus();});
  $('payAdv').onclick=()=>{const fx=f||L[0];ui.payAdvanced=true;fillCategoryOptions();$('fDate').value=t0;$('fFm').value=fx.fm;$('fVal').value=m2(fx.rest);initInvoiceForm();$('fFm').value=fx.fm;drawInvoiceForm();};
  if(!f)return;
  $('payNew').onclick=()=>{const st=cycleStart(f.fm),cd=closeDateOf(f.fm);openItem(null,t0>=st&&t0<=cd?t0:(t0<st?st:cd));};
  $('payGo').onclick=async()=>{
    const partial=payMode==='part',plan=planPayment(f.fm,[...payIds],payMode,partial?parseMoney($('payVal').value):0);
    if(plan.error)return partial?fieldError($('payVal'),plan.error):toast('⚠️ '+plan.error);
    const excess=paymentExcess(plan.value,f.rest);
    const html=`${tt(plan.full?'tx.pay.confirmFull':'tx.pay.confirmPartial',{due:formatDateBR(dueDateOf(f.fm))})}<dl class="dl mt-10"><div class="dl-r"><dt>${tt('tx.field.value')}</dt><dd><b>${f2(plan.value)}</b></dd></div>${plan.full?'':`<div class="dl-r"><dt>${tt('tx.pay.remainingAfter')}</dt><dd>${f2(plan.remaining)}</dd></div>`}<div class="dl-r"><dt>${tt('tx.field.date')}</dt><dd>${tt('tx.pay.todayDate',{date:formatDateBR(t0)})}</dd></div></dl>${excess>0?`<div class="bd-note">${tt('tx.pay.excessHtml',{undetailed:displayName(UNDETAILED_CAT),open:f2(f.rest),value:f2(plan.value),diff:f2(excess)})}</div>`:''}`;
    if(!await askConfirm({title:tt('tx.pay.confirmTitle'),html,ok:tt('tx.pay.confirmOk',{amount:f2(plan.value)})}))return;
    if(!runCommand(()=>payInvoice(f.fm,plan,t0),{render:false}))return;
    payMode='total';payIds=null;ui.cur=mOf(t0);render();
    toast(tt(plan.full?'tx.pay.donePaid':'tx.pay.donePartial',{name:invoiceName(f.fm),amount:f2(plan.value)}));};
}

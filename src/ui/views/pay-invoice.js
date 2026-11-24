/**
 * ui/views/pay-invoice.js
 * Responsibility: Pay invoice screen (quick mode): pick the invoice, full or partial amount,
 * confirm and cancel a payment. The amount rule is domain/invoice-payment.js (planPayment).
 * The look is in styles/08-screens.css.
 */
import { $, esc } from '../../core/dom.js';
import { f2, m2, sum } from '../../core/format.js';
import { formatDateBR, mOf, today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { deleteTransactions } from '../../domain/transactions.js';
import { icon } from '../../domain/categories.js';
import { closeDateOf, cycleStart, dueDateOf, dueMonth, invoiceMonthOf, nearestDueMonth } from '../../domain/card-cycle.js';
import { payableInvoices, payableItems } from '../../domain/card-invoices.js';
import { payInvoice, planPayment } from '../../domain/invoice-payment.js';
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
  const r=await askConfirm({title:'Cancelar pagamento da fatura',ok:'Cancelar pagamento',danger:true,
    html:`Deseja cancelar o pagamento da fatura que vence em <b>${formatDateBR(dueDateOf(invoiceMonthOf(t)))}</b>, no valor de <b>${f2(t.value)}</b> (pago em ${formatDateBR(t.date)})?<div class="bd-note mt-10">O dinheiro volta para o seu caixa e a fatura volta a ficar em aberto. As compras do cartão não são apagadas.</div>`});
  if(!r)return false;
  if(!runCommand(()=>deleteTransactions([t.id]),{render:false}))return false;
  payIds=null;render();toast('↩️ Pagamento cancelado: a fatura voltou a ficar em aberto');return true;}
function paidInvoicesList(){
  const ps=S.tx.filter(t=>t.type==='fatura').sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,5);
  if(!ps.length)return '';
  return `<div class="pay-paid"><div class="pay-paid-h">Pagamentos já registrados <span class="mut">· pagou sem querer? cancele aqui</span></div>`+
    ps.map(t=>`<div class="pay-line"><span class="pay-line-t">💳 ${invoiceName(invoiceMonthOf(t))} <span class="mut">· paga em ${formatDateBR(t.date)}</span></span><b>${f2(t.value)}</b><button type="button" class="btn sm dng" data-cp="${t.id}">Cancelar pagamento</button></div>`).join('')+'</div>';}
function bindPaidInvoices(box){box.querySelectorAll('[data-cp]').forEach(b=>b.onclick=()=>{const t=S.tx.find(x=>x.id===+b.dataset.cp);if(t)cancelPay(t);});}
export function renderPay(){
  const L=payableInvoices(),box=$('payBox'),t0=today();
  if(!L.length){box.innerHTML='<div class="empty pay-empty">Nenhuma fatura em aberto. Lance as compras com “Cartão de crédito” para elas aparecerem aqui.</div><div class="tc"><button type="button" class="btn sm" id="payAdv">Registrar pagamento manualmente</button></div>'+paidInvoicesList();bindPaidInvoices(box);$('payAdv').onclick=()=>{ui.payAdvanced=true;fillCategoryOptions();};return;}
  if(payOpen===null){const nf=nearestDueMonth(t0);payOpen=(L.find(f=>f.fm===nf)||L[0]).fm;}
  if(payOpen&&!L.some(f=>f.fm===payOpen))payOpen=L[0].fm;
  const fmNow=dueMonth(t0),head=L.filter(f=>f.fm<=fmNow),fut=L.filter(f=>f.fm>fmNow);
  const f=L.find(x=>x.fm===payOpen);
  let its=[];
  if(f){its=payableItems(f.fm);if(payIdsFm!==f.fm||!payIds){payIds=new Set(its.map(t=>t.id));payIdsFm=f.fm;}else payIds=new Set([...payIds].filter(id=>its.some(t=>t.id===id)));}
  const selTot=its.length?sum(its.filter(t=>payIds.has(t.id)).map(t=>t.value)):0,all=its.length>0&&payIds.size===its.length;
  // the open invoice: its purchases (check/uncheck), full or partial amount, pay button
  const purchaseLine=t=>`<div class="pay-line"><input type="checkbox" data-pi="${t.id}" ${payIds.has(t.id)?'checked':''} class="w-auto" aria-label="Incluir"><span data-pe="${t.id}" title="Clique para editar" class="pay-line-t tap-t">${formatDateBR(t.date)} · ${icon('despesa',t.cat)} ${esc(t.cat)} <span class="mut">${esc(t.desc||'')}</span> <span class="mut fs12">✎</span></span><b>${f2(t.value)}</b></div>`;
  const body=x=>{
    const amtAll=all||!its.length?x.rest:selTot,total=payMode==='total';
    return `<div class="pay-body">
      <div class="help pay-hint">Compras desta fatura (${formatDateBR(cycleStart(x.fm))} a ${formatDateBR(closeDateOf(x.fm))}). Desmarque o que não entra neste pagamento. Clique numa compra para editar.</div>
      ${its.length?its.map(purchaseLine).join(''):'<div class="help flush">Sem compras em aberto listadas.</div>'}
      <div class="pay-new"><button type="button" class="btn sm" id="payNew">+ Adicionar compra esquecida</button></div>
      <div class="pay-amount">
      <label class="pay-opt"><input type="radio" name="payM" value="total" ${total?'checked':''} class="w-auto">${all||!its.length?'Valor completo':'Só as compras marcadas'}: <b>${f2(amtAll)}</b></label>
      <label class="pay-opt last"><input type="radio" name="payM" value="part" ${total?'':'checked'} class="w-auto">Pagar outro valor (parcial)</label>
      <div id="payPartW" class="pay-part"${total?' hidden':''}><label for="payVal">Valor a pagar</label><input id="payVal" data-money placeholder="R$ 0,00"></div>
      <div class="row pay-go"><button type="button" class="btn pri" id="payGo">💳 Pagar fatura</button><span class="help flush">Registrado hoje, ${formatDateBR(t0)}. Sai do caixa e não conta como gasto de novo.</span></div></div></div>`;};
  // one invoice (accordion item)
  const acc=x=>{const on=x.fm===payOpen,dd=dueDateOf(x.fm),late=dd<t0;
    return `<div class="pay-inv${on?' on':''}"><div data-pa="${x.fm}" class="pay-inv-h"><span class="pay-caret">${on?'▾':'▸'}</span><span class="pay-inv-t"><b>${invoiceName(x.fm)}</b> <span class="mut">· vence ${formatDateBR(dd)}</span><br><span class="mut">${x.n} compra(s)${x.paid>0?' · já pago '+f2(x.paid):''}${late?' · <b class="late-t">vencida</b>':''}</span></span><b class="pay-inv-v">${f2(x.rest)}</b></div>${on?body(x):''}</div>`;};
  const futOpen=fut.some(x=>x.fm===payOpen);
  box.innerHTML=`<div class="pay-q">Qual fatura você vai pagar?</div>${head.map(acc).join('')||'<div class="help">Nenhuma fatura atual ou vencida em aberto.</div>'}
    ${fut.length?`<details id="payFut" ${futOpen?'open':''} class="pay-fut"><summary>Faturas futuras (${fut.length}) · ${f2(sum(fut.map(x=>x.rest)))}</summary><div class="mt-6">${fut.map(acc).join('')}</div></details>`:''}
    ${paidInvoicesList()}
    <div class="mt-12"><button type="button" class="btn sm btn-ghost" id="payAdv">Avançado: informar data, valor e compras manualmente</button></div>`;
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
    const html=`${plan.full?'Pagar a fatura':'Pagar <b>parcialmente</b> a fatura'} que vence em <b>${formatDateBR(dueDateOf(f.fm))}</b>?<dl class="dl mt-10"><div class="dl-r"><dt>Valor</dt><dd><b>${f2(plan.value)}</b></dd></div>${plan.full?'':`<div class="dl-r"><dt>Falta depois</dt><dd>${f2(plan.remaining)}</dd></div>`}<div class="dl-r"><dt>Data</dt><dd>hoje, ${formatDateBR(t0)}</dd></div></dl>${plan.value>f.rest+0.004?`<div class="bd-note">⚠️ O valor é maior que o da fatura (${f2(f.rest)}).</div>`:''}`;
    if(!await askConfirm({title:'Confirmar pagamento',html,ok:'💳 Pagar '+f2(plan.value)}))return;
    if(!runCommand(()=>payInvoice(f.fm,plan,t0),{render:false}))return;
    payMode='total';payIds=null;ui.cur=mOf(t0);render();
    toast('💳 '+(plan.full?invoiceName(f.fm)+' paga: ':'Pagamento da '+invoiceName(f.fm)+': ')+f2(plan.value));};
}

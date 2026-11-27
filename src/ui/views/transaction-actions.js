/**
 * ui/views/transaction-actions.js
 * Responsibility: what happens when a record is tapped: the detail view (all fields) with
 * Editar / Excluir / Fechar, the delete confirmation (naming the item and the value, with the
 * impact explained) and the global tap handling of rows with data-tx.
 */
import { UNDETAILED_CAT } from '../../domain/spending.js';
import { displayName } from '../../core/stored-names.js';
import { tt } from '../../core/i18n.js';
import { copyPrefill } from '../../domain/record-copy.js';
import { isReinvestment } from '../../domain/reinvestment.js';
import { esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { formatDateBR, mLabel, mOf, today } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { accName } from '../../domain/accounts.js';
import { catParts, deleteTransactions, futureSiblings, invoiceOfPurchase, restoreTransactions } from '../../domain/transactions.js';
import { icon } from '../../domain/categories.js';
import { dueDateOf, dueMonth, invoiceMonthOf } from '../../domain/card-cycle.js';
import { invoiceItems, invoiceUndetailed } from '../../domain/card-invoices.js';
import { isCard } from '../../domain/month-summary.js';
import { toast } from '../toast.js';
import { Sheet } from '../components/sheet.js';
import { askConfirm } from '../components/confirm.js';
import { TX_SIGN, paymentLabel, txRow, txTitle } from '../components/breakdown.js';
import { runCommand } from '../components/command.js';
import { openTxForm } from './transaction-form-sheet.js';
import { cancelPay } from './pay-invoice.js';
const TYPE_LABEL={despesa:()=>tt('tx.type.despesa'),receita:()=>tt('tx.type.receita'),aporte:()=>tt('tx.type.aporte')};
function txDetailView(id){
  return {render(body,foot){
    const t=S.tx.find(x=>x.id===id);if(!t)return null;
    const row=(k,v)=>v?`<div class="dl-r"><dt>${k}</dt><dd>${v}</dd></div>`:'';
    let extra='';
    if(t.type==='despesa'||t.type==='receita'){
      extra+=row(tt('tx.field.category'),t.splits&&t.splits.length?catParts(t).map(p=>`${icon(t.type,p.cat)} ${esc(displayName(p.cat))} <span class="mut">${f2(p.value)}</span>`).join('<br>'):`${icon(t.type,t.cat)} ${esc(displayName(t.cat))}`);
      extra+=row(t.type==='receita'?tt('tx.field.enteredIn'):tt('tx.field.paidWith'),esc(paymentLabel(t)));
      if(isCard(t)){const inv=invoiceOfPurchase(t),fm=dueMonth(t.date);
        extra+=row(tt('tx.field.invoice'),`${tt('tx.card.dueOn',{date:formatDateBR(dueDateOf(fm))})} · ${inv?'<span class="tag pay-vr">'+tt('tx.detail.paidOn',{date:formatDateBR(inv.date)})+'</span>':'<span class="tag pay-cartao">'+tt('tx.detail.open')+'</span>'}`);}
    }
    if(t.type==='aporte')extra+=row(isReinvestment(t)?tt('tx.detail.reinvestedIn'):tt('tx.detail.investedIn'),(isReinvestment(t)?'🔁 ':'🏦 ')+esc(accName(t.acc)));
    if(isReinvestment(t))extra+=row(tt('tx.detail.countsAs'),'<span class="mut">'+tt('tx.detail.notNewContribution')+'</span>');
    if(t.type==='fatura'){const its=invoiceItems(t),u=invoiceUndetailed(t);
      extra+=row(tt('tx.field.invoice'),tt('tx.card.dueOn',{date:formatDateBR(dueDateOf(invoiceMonthOf(t)))}));
      extra+=row(tt('tx.detail.identified'),its.length+' · '+f2(sumMoney(its.map(x=>x.value))));
      if(u>0.004)extra+=row(tt('tx.detail.undetailed'),tt('tx.detail.undetailedValue',{undetailed:displayName(UNDETAILED_CAT),amount:f2(u)}));
      if(its.length)extra+=`<div class="bd-gh mt-14"><span>${tt('tx.detail.invoicePurchases')}</span><b>${f2(sumMoney(its.map(x=>x.value)))}</b></div><div class="lst">${its.map(x=>txRow(x)).join('')}</div>`;}
    const sib=futureSiblings(t);
    body.innerHTML=`<div class="dt-head"><span class="tag ${t.type}">${t.type==='fatura'?tt('tx.detail.paidInvoiceTag'):TYPE_LABEL[t.type]?TYPE_LABEL[t.type]():t.type[0].toUpperCase()+t.type.slice(1)}</span>
      <div class="dt-v li-v ${t.type}">${TX_SIGN[t.type]} ${f2(t.value)}</div><div class="dt-t">${esc(txTitle(t))}</div></div>
      <dl class="dl">${row(tt('tx.field.date'),formatDateBR(t.date)+' <span class="mut">('+new Date(t.date+'T12:00').toLocaleDateString('pt-BR',{weekday:'long'})+')</span>')}${extra}${row(tt('tx.field.description'),t.desc?esc(t.desc):'<span class="mut">'+tt('tx.detail.noDesc')+'</span>')}
      ${sib.length?row(tt('tx.detail.repeat'),tt('tx.detail.moreSame',{count:sib.length})):''}${t.demo?row(tt('tx.detail.origin'),tt('tx.detail.testData')):''}</dl>`;
    foot.innerHTML=`<button type="button" class="btn dng" data-act="del">${t.type==='fatura'?tt('tx.pay.cancelBtn'):tt('tx.common.delete')}</button>${t.type==='fatura'?'':'<button type="button" class="btn" data-act="dup">'+tt('tx.common.repeat')+'</button>'}<button type="button" class="btn pri" data-act="edit">${tt('tx.common.edit')}</button>`;
    foot.querySelector('[data-act=del]').onclick=()=>deleteTxFlow(t.id);
    const dup=foot.querySelector('[data-act=dup]');
    if(dup)dup.onclick=()=>openTxForm({type:t.type,prefill:copyPrefill(t,today()),note:tt('tx.detail.copyNote',{title:txTitle(t)})});
    foot.querySelector('[data-act=edit]').onclick=()=>openTxForm({id:t.id});
    return {title:t.type==='fatura'?tt('tx.detail.titleInvoice'):tt('tx.detail.title'),sub:mLabel(mOf(t.date))};
  }};
}
export async function deleteTxFlow(id){
  const t=S.tx.find(x=>x.id===id);if(!t)return false;
  if(t.type==='fatura')return cancelPay(t);
  const sib=futureSiblings(t),inv=isCard(t)&&t.type==='despesa'?invoiceOfPurchase(t):null;
  const name=t.type==='aporte'?accName(t.acc):(t.desc||displayName(t.cat));
  let html=tt(t.type==='receita'?'tx.del.askIncome':t.type==='aporte'?'tx.del.askContribution':'tx.del.askExpense',{name:esc(name),amount:f2(t.value),date:formatDateBR(t.date)});
  if(inv)html+=`<div class="bd-note mt-10">${tt('tx.del.invNote',{undetailed:displayName(UNDETAILED_CAT),date:formatDateBR(inv.date)})}</div>`;
  if(t.type==='aporte'&&!isReinvestment(t))html+=`<div class="bd-note mt-10">${tt('tx.del.balanceDown',{account:esc(accName(t.acc)),amount:f2(t.value)})}</div>`;
  // a plain record is deleted at once (Desfazer brings it back); a choice or a side effect still asks first
  const ask=sib.length||inv||t.type==='aporte';
  const r=ask?await askConfirm({title:t.type==='aporte'?tt('tx.del.titleContribution'):tt('tx.del.titleTx'),html,ok:tt('tx.common.delete'),danger:true,
    check:sib.length?tt('tx.del.alsoFuture',{count:sib.length}):''}):{checked:false};
  if(!r)return false;
  const ids=[t.id].concat(r.checked?sib.map(x=>x.id):[]);
  const undo=runCommand(()=>deleteTransactions(ids));if(!undo)return false;
  toast(ids.length>1?tt('tx.del.doneMany',{count:ids.length,name}):tt('tx.del.doneOne',{name}),
    {action:{label:tt('tx.common.undo'),run:()=>runCommand(()=>restoreTransactions(undo),{ok:tt('tx.del.restored')})}});
  return true;
}
function openTxDetail(id){Sheet.depth()?Sheet.push(txDetailView(id)):Sheet.open(txDetailView(id));}
// any element with data-tx opens the record; buttons inside the row keep their own action
export function bindTransactionTaps(){
  const go=e=>{const r=e.target.closest('[data-tx]');if(!r)return false;
    const inner=e.target.closest('button,a,input,select,label');if(inner&&inner!==r&&r.contains(inner))return false;
    openTxDetail(+r.dataset.tx);return true;};
  document.addEventListener('click',go);
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-tx],[role=button][data-go]')){e.preventDefault();e.target.click();}});
}

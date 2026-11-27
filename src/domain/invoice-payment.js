/**
 * domain/invoice-payment.js
 * Responsibility: paying a card invoice. planPayment() decides the amount (full, only the checked
 * purchases, or a partial value) without touching the state; payInvoice() records it;
 * classifyUndetailed() turns part of a paid invoice into a categorized purchase.
 */
import { t } from '../core/i18n.js';
import { f2 } from '../core/format.js';
import { roundMoney, sumMoney } from '../core/money.js';
import { S } from './store.js';
import { ensureCat } from './categories.js';
import { alloc, invalidateAllocation, invoiceUndetailed, payableInvoices, payableItems } from './card-invoices.js';
import { INVOICE_CATEGORY } from './transaction-builder.js';
export function planPayment(fm,selectedIds,mode,partialValue){
  const inv=payableInvoices().find(f=>f.fm===fm);
  if(!inv)return {error:t('tx.pay.noOpen')};
  const items=payableItems(fm),sel=new Set(selectedIds||[]),chosen=items.filter(t=>sel.has(t.id));
  const all=!items.length||chosen.length===items.length;
  let value;
  if(mode==='part'){value=roundMoney(partialValue);if(!(value>0))return {error:t('tx.pay.enterAmount')};}
  else{value=all?inv.rest:sumMoney(chosen.map(t=>t.value));if(!(value>0))return {error:t('tx.pay.checkOne')};}
  return {value,full:value>=inv.rest-0.004,remaining:Math.max(0,roundMoney(inv.rest-value)),items:mode!=='part'&&!all?chosen.map(t=>t.id):null};
}
// what a payment pays above what is open on the invoice (0 when it does not): the app counts it as an expense "Cartão (sem detalhe)", it is not a credit for later invoices
export const paymentExcess=(value,open)=>{const x=roundMoney(value-open);return x>0.004?x:0;};
export function payInvoice(fm,plan,date){
  if(!plan||plan.error)return plan||{error:t('tx.pay.invalid')};
  const tx={id:S.nid++,type:'fatura',date,value:roundMoney(plan.value),desc:'',cat:INVOICE_CATEGORY,fm};
  if(plan.items)tx.items=plan.items.slice();
  S.tx.push(tx);invalidateAllocation();
  return {id:tx.id};
}
export function classifyUndetailed(invoiceId,{cat,desc,value}){
  const f=S.tx.find(x=>x.id===invoiceId);if(!f)return {error:t('tx.pay.invoiceNotFound')};
  cat=(cat||'').trim();if(!cat)return {error:t('tx.err.categoryRequired')};
  const free=invoiceUndetailed(f);value=roundMoney(value);
  if(!(value>0)||value>free+0.004)return {error:t('tx.pay.valueRange',{max:f2(free)})};
  ensureCat('despesa',cat);
  const items=alloc().map[f.id]||[],id=S.nid++;
  S.tx.push({id,date:f.date,type:'despesa',value,desc:(desc||'').trim(),cat,fonte:'cartao'});
  f.items=items.concat(id);invalidateAllocation();
  return {id};
}

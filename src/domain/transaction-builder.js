/**
 * domain/transaction-builder.js
 * Responsibility: rules for creating and editing a transaction, independent of the form.
 * validateTransaction(d) -> null | {field, msg}
 * saveTransaction(d)     -> {ids, siblings}   (new record, monthly series or edit + future siblings)
 * d = {editId, type, value, date, cat, fonte, desc, acc, splits:[{cat,value}], fm, items, repeat, applyToFuture, invoiceSelectedTotal}
 */
import { addMonths } from '../core/dates.js';
import { roundMoney, sumMoney } from '../core/money.js';
import { S } from './store.js';
import { futureSiblings } from './transactions.js';
import { ensureCat } from './categories.js';
const DEFAULT_CATEGORY={receita:'Outros',despesa:'Imprevistos / Outros'};
export const INVOICE_CATEGORY='Fatura do cartão';
const cleanSplits=d=>(d.type==='aporte'||d.type==='fatura')?[]:(d.splits||[]).filter(s=>s.cat&&s.cat.trim()&&s.value>0).map(s=>({cat:s.cat.trim(),value:roundMoney(s.value)}));
export function validateTransaction(d){
  if(!(d.value>0))return {field:'value',msg:'Digite o valor. Ex.: 3500 vira R$ 35,00'};
  if(!d.date)return {field:'date',msg:'Escolha a data no calendário'};
  if(d.type==='aporte'&&!d.acc)return {field:'acc',msg:'Escolha onde investir'};
  if(sumMoney(cleanSplits(d).map(s=>s.value))>d.value+0.004)return {field:'value',msg:'As partes divididas somam mais que o valor total'};
  if(d.type==='fatura'&&(d.invoiceSelectedTotal||0)>d.value+0.004)return {field:'value',msg:'As compras marcadas somam mais que o valor da fatura'};
  return null;
}
// copies the form data into a transaction (keeps id, date of siblings and series)
function applyFields(t,d,date){
  if(date)t.date=date;
  t.type=d.type;t.value=roundMoney(d.value);t.desc=(d.desc||'').trim();
  delete t.acc;delete t.cat;delete t.fonte;delete t.splits;delete t.fm;delete t.items;
  if(d.type==='aporte')t.acc=d.acc;
  else if(d.type==='fatura'){t.cat=INVOICE_CATEGORY;t.fm=d.fm;t.items=(d.items||[]).filter(id=>S.tx.some(x=>x.id===id));}
  else{t.cat=(d.cat||'').trim()||DEFAULT_CATEGORY[d.type];t.fonte=d.fonte||'caixa';const sp=cleanSplits(d);if(sp.length)t.splits=sp;}
  return t;
}
export function saveTransaction(d){
  if(d.type==='despesa'||d.type==='receita'){ensureCat(d.type,(d.cat||'').trim()||DEFAULT_CATEGORY[d.type]);cleanSplits(d).forEach(s=>ensureCat(d.type,s.cat));}
  if(d.editId!==undefined&&d.editId!==null){
    const old=S.tx.find(t=>t.id===d.editId);
    if(!old)throw new Error('Lançamento não encontrado');
    const sibs=d.applyToFuture?futureSiblings(old):[];
    applyFields(old,d,d.date);sibs.forEach(x=>applyFields(x,d));
    return {ids:[old.id],siblings:sibs.length};
  }
  const n=d.type==='fatura'?1:Math.max(1,+d.repeat||1),serie=n>1?S.nid++:undefined,ids=[];
  for(let i=0;i<n;i++){const t={id:S.nid++};if(serie)t.serie=serie;applyFields(t,d,addMonths(d.date,i));S.tx.push(t);ids.push(t.id);}
  return {ids,siblings:0};
}

/**
 * domain/transactions.js
 * Responsibility: Transaction queries (by month/type, contributions, category parts, future series)
 * and the delete / undo-delete commands.
 */
import { sum } from '../core/format.js';
import { asOf, mOf } from '../core/dates.js';
import { roundMoney, sumMoney } from '../core/money.js';
import { S } from './store.js';
import { alloc } from './card-invoices.js';
export const txIn=(m,type,upto)=>S.tx.filter(t=>t.type===type&&mOf(t.date)===m&&(!upto||t.date<=upto));
export const contributionsInMonth=m=>sum(txIn(m,'aporte',asOf(m)).map(t=>t.value));
// category parts of a transaction: the informed splits + the remainder in the main category
export const catParts=t=>{const ex=t.splits||[];const rest=roundMoney(t.value-sumMoney(ex.map(s=>s.value)));return ex.concat(rest>0.004?[{cat:t.cat,value:rest}]:[]);};
// "equal" future transactions (same Repeat series; for old ones, same data)
export const futureSiblings=t=>{
  if(t.type==='fatura')return [];
  if(t.serie)return S.tx.filter(x=>x.serie===t.serie&&x.id!==t.id&&x.date>t.date);
  return S.tx.filter(x=>x.id!==t.id&&!x.serie&&x.type===t.type&&x.date>t.date&&mOf(x.date)!==mOf(t.date)&&x.cat===t.cat&&(x.desc||'')===(t.desc||'')&&(x.fonte||'')===(t.fonte||'')&&(x.acc||'')===(t.acc||'')&&Math.abs(x.value-t.value)<0.005);
};
// removes transactions and drops them from the invoices that listed them
// returns what was removed ({removed, items}) so restoreTransactions can undo it exactly
export function deleteTransactions(ids){
  const del=new Set(ids),copy=x=>JSON.parse(JSON.stringify(x));
  const removed=S.tx.filter(t=>del.has(t.id)).map(copy),items={};
  S.tx.forEach(t=>{if(t.items&&t.items.some(id=>del.has(id)))items[t.id]=t.items.slice();});
  S.tx=S.tx.filter(t=>!del.has(t.id));
  S.tx.forEach(t=>{if(t.items)t.items=t.items.filter(id=>!del.has(id));});
  return {removed,items};
}
// undo of deleteTransactions: puts the records back with their ids and the invoices' lists as they were
export function restoreTransactions(undo){
  if(!undo||!undo.removed||!undo.removed.length)return {error:'Nada para desfazer'};
  const taken=new Set(S.tx.map(t=>t.id));
  if(undo.removed.some(t=>taken.has(t.id)))return {error:'Esses lançamentos já existem'};
  S.tx=S.tx.concat(undo.removed.map(t=>JSON.parse(JSON.stringify(t))));
  Object.keys(undo.items||{}).forEach(id=>{const inv=S.tx.find(t=>String(t.id)===id);if(inv)inv.items=undo.items[id].slice();});
  return {restored:undo.removed.length};
}
// the paid invoice that currently absorbs a card purchase (null when it is still open)
export function invoiceOfPurchase(t){const {map}=alloc();const id=Object.keys(map).find(k=>map[k].includes(t.id));return id?S.tx.find(x=>x.id===+id)||null:null;}
const TYPE_LABEL={despesa:'despesa',receita:'receita',aporte:'aporte',fatura:'pagamento de fatura'};

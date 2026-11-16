/**
 * domain/transaction-filter.js
 * Responsibility: which transactions the list shows for a month and a filter (type, expense
 * group, search text), and the amount that counts for each one (with a group filter, only the
 * part of the record that belongs to the group, so the list total matches the group total).
 */
import { mOf } from '../core/dates.js';
import { sumMoney } from '../core/money.js';
import { accName } from './accounts.js';
import { catParts } from './transactions.js';
import { groupOf } from './category-groups.js';
import { S } from './store.js';
export const ALL_TYPES='todos';
// f = {type: 'todos'|'receita'|'despesa'|'aporte'|'fatura', group: '' or group name, query: text}
// returns [{t, value}] newest first
export function filterTransactions(month,f={}){
  const type=f.type||ALL_TYPES,group=f.group||'',ql=String(f.query||'').trim().toLowerCase();
  const text=t=>((t.desc||'')+' '+(t.cat||'')+' '+(t.splits||[]).map(s=>s.cat).join(' ')+' '+(t.acc?accName(t.acc):'')).toLowerCase();
  return S.tx.filter(t=>mOf(t.date)===month&&(type===ALL_TYPES||t.type===type)&&(!ql||text(t).includes(ql)))
    .map(t=>{
      if(!group)return {t,value:t.value};
      if(t.type!=='despesa')return null;
      const part=sumMoney(catParts(t).filter(p=>groupOf(p.cat)===group).map(p=>p.value));
      return part>0?{t,value:part}:null;})
    .filter(Boolean)
    .sort((a,b)=>b.t.date.localeCompare(a.t.date)||b.t.id-a.t.id);
}
// signed total of a filtered list (income +, everything else −)
export const listTotal=rows=>sumMoney(rows.map(r=>r.t.type==='receita'?r.value:-r.value));

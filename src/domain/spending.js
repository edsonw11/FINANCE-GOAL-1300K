/**
 * domain/spending.js
 * Responsibility: spending window used by the trend chart, the analysis and the category detail:
 * 12 months ending at the selected month (or today), which ones are closed, and the
 * records behind a category or a group in a month (split parts and the undetailed part of paid invoices).
 */
import { mIdx, mKey, mOf, today } from '../core/dates.js';
import { catParts, txIn } from './transactions.js';
import { invoiceUndetailed } from './card-invoices.js';
import { monthSpending } from './month-summary.js';
import { roundMoney } from '../core/money.js';
import { catMonth } from './categories.js';
import { groupOf } from './category-groups.js';
export const UNDETAILED_CAT='Cartão (sem detalhe)';
export function spendingWindow(sel){
  const nowM=mOf(today()),end=Math.max(mIdx(sel),mIdx(nowM)),ms=[];
  for(let k=end-11;k<=end;k++)ms.push(mKey(k));
  const vals=ms.map(monthSpending),part=ms.map(m=>m===nowM);
  const ci=ms.map((m,k)=>k).filter(k=>!part[k]&&vals[k]>0&&mIdx(ms[k])<mIdx(nowM));
  return {ms,vals,part,ci,nowM};
}
// [{t, value}] whose values add up to catMonth(m)[cat]
export function categoryItems(m,cat){
  const out=[];
  if(cat===UNDETAILED_CAT){txIn(m,'fatura').forEach(t=>{const u=invoiceUndetailed(t);if(u>0)out.push({t,value:u});});return out;}
  txIn(m,'despesa').forEach(t=>catParts(t).forEach(p=>{if(p.cat===cat)out.push({t,value:p.value});}));
  return out.sort((a,b)=>b.t.date.localeCompare(a.t.date));
}
// {group: value} of a month: catMonth added up by group (same grand total)
export function groupMonth(m){const g={};Object.entries(catMonth(m)).forEach(([c,v])=>{const k=groupOf(c);g[k]=roundMoney((g[k]||0)+v);});return g;}
// [{t, value, cats}] whose values add up to groupMonth(m)[group]; one row per record
// (a record split into Água + Gás + Moradia shows once in Moradia, with the sum of those parts)
export function groupItems(m,group){
  const byTx=new Map();
  if(group===UNDETAILED_CAT)return categoryItems(m,group).map(i=>({...i,cats:[group]}));
  txIn(m,'despesa').forEach(t=>catParts(t).forEach(p=>{if(groupOf(p.cat)!==group)return;
    const r=byTx.get(t.id)||{t,value:0,cats:[]};r.value=roundMoney(r.value+p.value);if(!r.cats.includes(p.cat))r.cats.push(p.cat);byTx.set(t.id,r);}));
  return [...byTx.values()].sort((a,b)=>b.t.date.localeCompare(a.t.date));
}

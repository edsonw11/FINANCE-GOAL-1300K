/**
 * domain/category-suggestions.js
 * Responsibility: the few categories offered as one-tap choices when a record (or a part of a split) is typed:
 * the most used in the last 6 months for that kind of record, completed with other active categories of the
 * catalog until the limit. Archived (off) categories are never offered. Pure read.
 */
import { addMonths, today } from '../core/dates.js';
import { S } from './store.js';
export const CHIP_LIMIT=6;
// -> category names, most used first
export function topCategories(type,limit){
  const max=limit||CHIP_LIMIT,from=addMonths(today(),-6),cnt={};
  const on=new Set(((S.cats||{})[type]||[]).filter(c=>!c.off).map(c=>c.name));
  S.tx.forEach(t=>{if(t.type===type&&t.date>=from&&on.has(t.cat))cnt[t.cat]=(cnt[t.cat]||0)+1;});
  const top=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]||a.localeCompare(b)).slice(0,max);
  [...on].forEach(c=>{if(top.length<max&&!top.includes(c))top.push(c);});
  return top;
}

/**
 * domain/card-cycle.js
 * Responsibility: Credit card cycle rules: best purchase day, closing, due date, and which invoice a purchase belongs to.
 */
import { addDay, daysBetween, daysInMonth, formatISODate, isWeekend, mIdx, mKey, mOf, pad2 } from '../core/dates.js';
import { S } from './store.js';
// ---- card invoice: checked purchases + whatever is left undetailed ----
// ---- invoice cycle: best purchase day and due date ----
// "Best purchase day" = day the new invoice starts; the previous invoice closes the day before.
const DEFAULT_BEST_DAY=29,DEFAULT_DUE_DAY=7;
const isCardDay=n=>Number.isInteger(n)&&n>=1&&n<=31;
export const CARD=()=>{
  if(!S.card)S.card={best:29,due:7,biz:true,over:{},v3:true};
  if(S.card.best===undefined){S.card={best:Math.min((S.card.close||0)+1,31),due:S.card.due||7};}
  if(!S.card.v3){S.card={best:29,due:S.card.due||7,biz:true,over:S.card.over||{},v3:true};}
  // defensive: the days are whole numbers from 1 to 31 (the form guarantees it; a backup edited by hand or damaged may not). A bad one is replaced by the default, a good one is never touched.
  const c=S.card;if(!isCardDay(c.best)||!isCardDay(c.due))S.card={...c,best:isCardDay(c.best)?c.best:DEFAULT_BEST_DAY,due:isCardDay(c.due)?c.due:DEFAULT_DUE_DAY};
  return S.card;};
// closing date of cycle "j" (month j, day best-1; if best=1, the last day of month j)
const closingIn=(y,mi)=>{const B=CARD().best;return B===1?formatISODate(new Date(y,mi+1,0)):formatISODate(new Date(y,mi,Math.min(B-1,daysInMonth(y,mi))));};
// due date = first "due" day after closing
const dueAfter=cl=>{const [y,m]=cl.split('-').map(Number),D=CARD().due;
  const t1=formatISODate(new Date(y,m-1,Math.min(D,daysInMonth(y,m-1))));if(t1>cl)return t1;
  const ny=m===12?y+1:y,nm=m===12?0:m;return formatISODate(new Date(ny,nm,Math.min(D,daysInMonth(ny,nm))));};
export const dueDateOf=fm=>{const [y,m]=fm.split('-').map(Number);return fm+'-'+pad2(Math.min(CARD().due,daysInMonth(y,m-1)));};
// default closing of the invoice due in fm; moves to the next business day on weekends (if the option is on)
export function ruleClosing(fm){
  let base=fm+'-01';
  for(let k=0;k<=2;k++){const j=mIdx(fm)-k,cl=closingIn(Math.floor(j/12),j%12);if(dueAfter(cl).slice(0,7)===fm){base=cl;break;}}
  if(CARD().biz!==false)while(isWeekend(base))base=addDay(base,1);
  return base;}
// closing can be overridden per invoice (S.card.over), matching the bank app
export const closeDateOf=fm=>(CARD().over&&CARD().over[fm])||ruleClosing(fm);
// a purchase belongs to the first invoice whose closing has not passed yet
export function dueMonth(date){const m0=mIdx(mOf(date));for(let i=m0-1;i<=m0+3;i++){const fm=mKey(i);if(closeDateOf(fm)>=date)return fm;}return mKey(m0+1);}
export const cycleStart=fm=>addDay(closeDateOf(mKey(mIdx(fm)-1)),1);
export function nearestDueMonth(date){const m0=mIdx(mOf(date));let best=null,bd=1e9;for(let i=m0-1;i<=m0+1;i++){const dd=Math.abs(daysBetween(date,dueDateOf(mKey(i))));if(dd<bd){bd=dd;best=mKey(i);}}return best;}
export const invoiceMonthOf=f=>f.fm||nearestDueMonth(f.date);

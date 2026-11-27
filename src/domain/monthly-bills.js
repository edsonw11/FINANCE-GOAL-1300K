/**
 * domain/monthly-bills.js
 * Responsibility: "Contas do mês": the recurring expenses of a month (condomínio, luz, água,
 * convênio...) and whether each one is paid, scheduled or still missing.
 *   paid      : entered in the month with a date up to today
 *   scheduled : entered with a future date (e.g. the next copies of a monthly series)
 * A bill also needs a similar value every month (variation up to 20%) or to be a monthly series,
 * and the user can hide one ("Não é conta").
 *   missing   : it was paid once a month in at least 2 of the previous 3 months but is not in this
 *               month yet
 *               (expected value and day come from the most recent month)
 */
import { addMonths, mIdx, mKey, mOf, today } from '../core/dates.js';
import { sumMoney } from '../core/money.js';
import { t } from '../core/i18n.js';
import { S } from './store.js';
export const BILL_STATUS={paid:'paid',scheduled:'scheduled',missing:'missing'};
export const LOOKBACK_MONTHS=3,MIN_OCCURRENCES=2;
// a bill has a similar value every month (light varies a little; restaurants vary a lot)
export const MAX_VARIATION=0.2;
const variation=vs=>{const n=vs.length,mean=vs.reduce((a,b)=>a+b,0)/n;if(!mean)return 0;return Math.sqrt(vs.reduce((a,v)=>a+(v-mean)**2,0)/n)/mean;};
const ignored=()=>new Set(S.billsIgnored||[]);
const norm=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
// the same bill in different months: same category and description (series share the serie id)
export const billKey=t=>norm(t.cat)+'|'+norm(t.desc);
const expensesIn=m=>S.tx.filter(t=>t.type==='despesa'&&mOf(t.date)===m);
export function monthlyBills(m,day=today()){
  const prevMonths=[];for(let k=1;k<=LOOKBACK_MONTHS;k++)prevMonths.push(mKey(mIdx(m)-k));
  const seen=new Map(); // key -> {count, last}
  prevMonths.forEach(pm=>{const perMonth=new Map();expensesIn(pm).forEach(t=>{const k=billKey(t);perMonth.set(k,(perMonth.get(k)||0)+1);
    const s=seen.get(k)||{count:0,last:null,many:false,values:[],serie:false};if(!s.last||t.date>s.last.date)s.last=t;
    s.values.push(t.value);if(t.serie)s.serie=true;seen.set(k,s);});
    perMonth.forEach((n,k)=>{const s=seen.get(k);s.count++;if(n>1)s.many=true;});});
  // a bill happens once a month: several purchases with the same name (e.g. Mercado) are not a bill
  const skip=ignored();
  const recurring=new Set([...seen].filter(([k,s])=>!skip.has(k)&&s.count>=MIN_OCCURRENCES&&!s.many&&(s.serie||variation(s.values)<=MAX_VARIATION)).map(([k])=>k));
  const items=[],inMonth=new Set();
  expensesIn(m).forEach(t=>{const k=billKey(t);
    if(skip.has(k)||(!t.serie&&!recurring.has(k)))return;
    inMonth.add(k);
    items.push({key:k,cat:t.cat,desc:t.desc||'',value:t.value,date:t.date,t,status:t.date<=day?BILL_STATUS.paid:BILL_STATUS.scheduled});});
  recurring.forEach(k=>{if(inMonth.has(k))return;const last=seen.get(k).last;
    // expected on the same day of the month as last time (clamped to the month length)
    items.push({key:k,cat:last.cat,desc:last.desc||'',value:last.value,date:addMonths(last.date,mIdx(m)-mIdx(mOf(last.date))),t:null,status:BILL_STATUS.missing});});
  const order={missing:0,scheduled:1,paid:2};
  items.sort((a,b)=>order[a.status]-order[b.status]||a.date.localeCompare(b.date));
  const of=st=>items.filter(i=>i.status===st);
  return {items,count:items.length,paidCount:of('paid').length,ignoredCount:skip.size,
    paid:sumMoney(of('paid').map(i=>i.value)),pending:sumMoney(items.filter(i=>i.status!=='paid').map(i=>i.value))};
}
// "Não é conta": the user hides a bill the rule picked by mistake (kept until restored)
export function ignoreBill(key){
  if(!key)return {error:t('sum.bills.notFound')};
  S.billsIgnored=S.billsIgnored||[];if(!S.billsIgnored.includes(key))S.billsIgnored.push(key);
  return {key};
}
export function restoreIgnoredBills(){const n=(S.billsIgnored||[]).length;S.billsIgnored=[];return {restored:n};}

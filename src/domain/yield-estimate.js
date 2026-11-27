/**
 * domain/yield-estimate.js
 * Responsibility: the balance of an investment account on a past date, WITH the yield that happened between two balances the person typed.
 * Between two typed balances (or from the first aporte to the first typed balance) the app used to add only the aportes, so the bars of the evolution
 * chart climbed by the money put in and then jumped at the next typed balance. Here the yield between the two balances is spread over the days in
 * between: one constant daily growth factor that makes the starting balance and the aportes (each growing from its own date) arrive exactly at the next typed
 * balance. Only the net balance is estimated; after the LAST typed balance nothing is estimated (the real balance is shown, the projection takes over).
 * An implied yield that is not plausible (more than MAX_ANNUAL a year or less than MIN_ANNUAL, for example when money was deposited without being entered as an aporte)
 * is not spread: the old behaviour (aportes only) is kept for that stretch. Reinvestments are not new money, so they are not flows here either.
 */
import { daysBetween } from '../core/dates.js';
import { S } from './store.js';
import { balance } from './accounts.js';
import { isNewContribution } from './reinvestment.js';
export const MAX_ANNUAL=1.0,MIN_ANNUAL=-0.5; // 100 % and -50 % a year
const DAYS_PER_YEAR=365;
const BOUND=Math.log(1+MAX_ANNUAL)/DAYS_PER_YEAR,LOW_BOUND=Math.log(1+MIN_ANNUAL)/DAYS_PER_YEAR;
// value on `date` of a starting amount and aportes [{date, value}] growing at `rho` per day (continuous)
const grown=(start,flows,rho,date)=>(start?start.value*Math.exp(rho*daysBetween(start.date,date)):0)
  +flows.filter(f=>f.date<=date).reduce((a,f)=>a+f.value*Math.exp(rho*daysBetween(f.date,date)),0);
// the daily rate (continuous) that takes start + flows to `target` on `end`; null when no plausible rate does
export function impliedRate(start,flows,end,target){
  const f=r=>grown(start,flows,r,end)-target;
  if(f(LOW_BOUND)>0||f(BOUND)<0)return null;
  let lo=LOW_BOUND,hi=BOUND;
  for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(f(mid)<0)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
// the stretch of the account that contains `date`: {start:{date,value}|null, flows, end:{date,value}} or null when the date is after the last typed balance
function stretch(acc,date){
  const snaps=S.snaps.filter(s=>s.acc===acc).sort((a,b)=>a.date.localeCompare(b.date));
  const end=snaps.find(s=>s.date>date);if(!end)return null;
  const start=snaps.filter(s=>s.date<=date).pop()||null;
  const from=start?start.date:'0000-00-00';
  const flows=S.tx.filter(t=>isNewContribution(t)&&t.acc===acc&&t.date>from&&t.date<=end.date).map(t=>({date:t.date,value:t.value}));
  return {start:start?{date:start.date,value:start.value}:null,flows,end:{date:end.date,value:end.value}};
}
// {v, estimated}: the balance on `date` with the yield between typed balances; estimated=false when it is the real balance
export function estimatedBalance(acc,date){
  const real=balance(acc,date).v,s=stretch(acc,date);
  if(!s)return {v:real,estimated:false};
  const rho=impliedRate(s.start,s.flows,s.end.date,s.end.value);
  if(rho===null||Math.abs(rho)<1e-12)return {v:real,estimated:false};
  const v=grown(s.start,s.flows,rho,date);
  return {v:Math.round(v*100)/100,estimated:true};
}

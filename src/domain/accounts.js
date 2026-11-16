/**
 * domain/accounts.js
 * Responsibility: Investment accounts: name, balances by date (net and gross).
 */
import { sum } from '../core/format.js';
import { S } from './store.js';
export const active=()=>S.accounts.filter(a=>!a.archived);
export const accName=id=>(S.accounts.find(a=>a.id===id)||{name:'?'}).name;
// ---------- calculations ----------
export function balance(acc,date){
  let sn=null;S.snaps.forEach(s=>{if(s.acc===acc&&s.date<=date&&(!sn||s.date>=sn.date))sn=s;});
  const from=sn?sn.date:'0000-00-00';
  const ap=sum(S.tx.filter(t=>t.type==='aporte'&&t.acc===acc&&t.date>from&&t.date<=date).map(t=>t.value));
  return {v:(sn?sn.value:0)+ap,snap:sn,g:(sn&&sn.gross>0)?sn.gross+ap:null};
}
export const total=date=>sum(S.accounts.map(a=>balance(a.id,date).v));
// gross = as the apps show it; accounts without a gross value count by their net value (approximation)
export function totalGross(date){let g=0,ok=true;S.accounts.forEach(a=>{const b=balance(a.id,date);if(b.g!==null)g+=b.g;else{g+=b.v;if(b.v>0.005)ok=false;}});return {g,ok};}

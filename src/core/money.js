/**
 * core/money.js
 * Responsibility: money rules shared by every screen. Amounts are kept as numbers with
 * at most 2 decimals; every total is summed in integer cents to avoid floating point drift.
 * Pure functions only (no DOM).
 */
import { parse } from './format.js';
export const toCents=v=>Math.round((+v||0)*100);
const fromCents=c=>c/100;
export const roundMoney=v=>fromCents(toCents(v));
export const sumMoney=a=>fromCents(a.reduce((acc,v)=>acc+toCents(v),0));
// "123456" -> "R$ 1.234,56" (cash-register style: the last two digits are the cents)
export function formatMoneyDigits(text){
  const d=String(text||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,13);
  if(!d)return '';
  const c=parseInt(d,10);
  return 'R$ '+fromCents(c).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
// any typed or pasted text ("R$ 1.234,56", "1500", "1.500,5", "12.3") -> number with 2 decimals
export const parseMoney=s=>roundMoney(parse(s));

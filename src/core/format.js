/**
 * core/format.js
 * Responsibility: Brazilian-style number formatting and parsing (R$, %, decimal comma) and sum.
 */
import { formatNumber, decimalSeparator } from './locale-format.js';
export const f0=v=>'R$ '+formatNumber(Math.round(v),0);
export const f2=v=>'R$ '+formatNumber(v,2);
export const pc=v=>(v*100).toFixed(1).replace('.',decimalSeparator())+'%';
export const sum=a=>a.reduce((x,y)=>x+y,0);
/**
 * parse(text): a number typed by the person ("R$ 1.234,56", "1,234.56", "1500", "12,5%").
 * With both separators the LAST one is the decimal. With one kind only: the separator of the active language is the decimal
 * (twice means thousands), the other one is thousands when it groups by three ("1.500" in pt = 1500, "1,500" in en = 1500), else a decimal.
 */
export function parse(s){
  s=String(s).trim().replace(/[R$\s%]/g,'');if(!s)return 0;
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.'),dec=decimalSeparator();
  if(lc>=0&&ld>=0){const d=lc>ld?',':'.';s=s.split(d==='.'?',':'.').join('').replace(d,'.');}
  else if(lc>=0||ld>=0){
    const c=lc>=0?',':'.',n=s.split(c).length-1,groups=new RegExp('^\\d{1,3}(\\'+c+'\\d{3})+$').test(s);
    const asDecimal=c===dec?n===1:!groups;
    s=asDecimal?s.replace(c,'.'):s.split(c).join('');
    if(asDecimal&&s.split('.').length>2)return 0;
  }
  const n=parseFloat(s);return isNaN(n)?0:n;}
// ---- R$ amount fields (mask) and dd/mm/yyyy dates ----
export const m2=v=>'R$ '+formatNumber(v,2);

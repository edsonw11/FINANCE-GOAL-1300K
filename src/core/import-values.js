/**
 * core/import-values.js
 * Responsibility: reads dates and money amounts the way bank files write them
 * (dd/mm/yyyy, yyyy-mm-dd, yyyymmdd[hhmmss], "R$ 1.234,56", "-12,50", "(12,50)", "12,50-", "12.50", "1,234.56").
 * Dates are read as written (calendar day), never through a timezone, so a day never shifts.
 * Pure functions: return null when the text is not a date / amount.
 */
import { pad2, today } from './dates.js';
import { roundMoney } from './money.js';
const validDate=(y,m,d)=>{if(y<1900||y>2200)return false;const dt=new Date(y,m-1,d);return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d;};
const isoOf=(y,m,d)=>validDate(y,m,d)?y+'-'+pad2(m)+'-'+pad2(d):null;
// ref (ISO) is only used when the text has no year ("05/11"): the latest such date that is not after ref
export function parseBrDate(text,ref){
  const s=String(text==null?'':text).trim();let m;
  if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)))return isoOf(+m[1],+m[2],+m[3]);
  if((m=s.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6}(?:\.\d+)?)?(?:\[.*\])?$/)))return isoOf(+m[1],+m[2],+m[3]);
  if((m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:\D.*)?$/)))return isoOf(m[3].length===2?2000+ +m[3]:+m[3],+m[2],+m[1]);
  if((m=s.match(/^(\d{1,2})[/.-](\d{1,2})$/))){
    const r=ref||today(),ry=+r.slice(0,4);let d=isoOf(ry,+m[2],+m[1]);
    if(d&&d>r)d=isoOf(ry-1,+m[2],+m[1]);
    return d;
  }
  return null;
}
// signed number with 2 decimals, or null. Negative: leading "-", trailing "-", parentheses or a trailing "D".
export function parseAmount(text){
  let s=String(text==null?'':text).trim(),neg=false;
  if(!s)return null;
  if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}
  if(/-\s*$/.test(s)){neg=true;s=s.replace(/-\s*$/,'');}
  if(/^[^\d]*-/.test(s))neg=true;
  const dc=s.match(/\s([CD])\s*$/i);if(dc){if(/d/i.test(dc[1]))neg=true;s=s.slice(0,dc.index);}
  s=s.replace(/[^\d.,]/g,'');
  if(!/\d/.test(s))return null;
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.'),count=ch=>s.split(ch).length-1;
  let dec=null;
  if(lc>=0&&ld>=0)dec=lc>ld?',':'.';
  else if(lc>=0)dec=count(',')===1&&s.length-lc-1<=2?',':null;
  else if(ld>=0)dec=count('.')===1&&s.length-ld-1<=2?'.':null;
  const clean=dec?s.split(dec==='.'?',':'.').join('').replace(dec,'.'):s.replace(/[.,]/g,'');
  const n=parseFloat(clean);
  if(!isFinite(n))return null;
  return roundMoney(neg?-n:n);
}

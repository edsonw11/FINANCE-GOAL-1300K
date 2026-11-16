/**
 * core/format.js
 * Responsibility: Brazilian-style number formatting and parsing (R$, %, decimal comma) and sum.
 */
export const f0=v=>'R$ '+Math.round(v).toLocaleString('pt-BR');
export const f2=v=>'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const n2=v=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
export const pc=v=>(v*100).toFixed(1).replace('.',',')+'%';
export const sum=a=>a.reduce((x,y)=>x+y,0);
export function parse(s){s=String(s).trim().replace(/[R$\s%]/g,'');if(!s)return 0;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=parseFloat(s);return isNaN(n)?0:n;}
// ---- R$ amount fields (mask) and dd/mm/yyyy dates ----
export const m2=v=>'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

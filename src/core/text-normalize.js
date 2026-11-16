/**
 * core/text-normalize.js
 * Responsibility: text helpers for matching descriptions: lowercase without accents or punctuation,
 * the significant words of a description, and a short stable hash (used to recognise a file or a row again).
 * Pure functions.
 */
export const normalizeText=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// words that say how the money moved, not who received it
const NOISE=new Set(['compra','compras','debito','credito','pix','enviado','recebido','pagamento','pagto','pgto','transferencia','transf','cartao','no','na','em','de','da','do','das','dos','ltda','sa','me','epp','com','br','a','o','e','via','pag','parcela','parc','ted','doc']);
// "COMPRA NO DEBITO - MERCADO EXTRA 1234" -> ['mercado','extra']
// removes accents only: digits and punctuation stay (dates and amounts are matched on it)
export const stripAccents=t=>String(t==null?'':t).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const significantWords=s=>normalizeText(s).split(' ').filter(w=>w.length>=3&&!/^\d+$/.test(w)&&!NOISE.has(w));
export const descriptionKey=s=>significantWords(s).slice(0,3).join(' ');
// FNV-1a, two seeds -> 16 hex chars (not for security: only to compare)
export function textHash(s){
  s=String(s==null?'':s);let a=0x811c9dc5,b=0x9747b28c;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,0x01000193)>>>0;b=Math.imul(b^c,0x85ebca6b)>>>0;}
  return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}

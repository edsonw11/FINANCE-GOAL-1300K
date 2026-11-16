/**
 * domain/brokerage-note.js
 * Responsibility: reads the text of a B3 brokerage note ("nota de negociação / corretagem") into trades:
 * the trading day, each buy or sell (ticker, quantity, price), and the costs, which are shared among the
 * trades in proportion to their value. Approximate on purpose: a line that does not look like a trade is
 * ignored, and anything missing (like a ticker) is left empty for the user to fill in the review.
 */
import { parseAmount, parseBrDate } from '../core/import-values.js';
import { stripAccents } from '../core/text-normalize.js';
import { roundMoney, sumMoney } from '../core/money.js';
import { classOfTicker } from './ticker-class.js';
const NUM='(\\d{1,3}(?:\\.\\d{3})*|\\d+)',PRICE='(\\d{1,3}(?:\\.\\d{3})*,\\d{2,4})',TOTAL='(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';
// "1-BOVESPA C VISTA PETR4 PN N2 100 38,20 3.820,00 D"
const TRADE_ROW=new RegExp('(?:^|\\s)(?:1-)?BOVESPA\\s+([CV])\\s+(\\S+)\\s+(.+?)\\s+'+NUM+'\\s+'+PRICE+'\\s+'+TOTAL+'\\s*[DC]?\\s*$','i');
const TICKER=/\b([A-Z]{4}\d{1,2})\b/;
const FII_NAME=/\bFII\s+([A-Z]{4})\b/;
const COST_LABELS=/(taxa de liquidacao|taxa de registro|emolumentos|taxa a\.?n\.?a|taxa de termo|corretagem|iss)\D{0,40}?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
const COST_TOTAL=/total (?:custos|despesas)[^\d\n]{0,25}(\d{1,3}(?:\.\d{3})*,\d{2})/i;
export const looksLikeBrokerageNote=text=>{
  const n=stripAccents(text).toLowerCase();
  return /nota de (negociacao|corretagem)/.test(n)||(/bovespa/.test(n)&&/corretagem/.test(n)&&/liquidacao/.test(n));
};
function tickerOf(spec){
  const m=spec.match(TICKER);if(m)return m[1];
  const f=spec.match(FII_NAME);return f?f[1]+'11':'';
}
function costsOf(text){
  const t=stripAccents(text),total=t.match(COST_TOTAL);
  if(total)return parseAmount(total[1]);
  return sumMoney([...t.matchAll(COST_LABELS)].map(m=>parseAmount(m[2])));
}
// shares the costs by value; the last trade takes the rounding rest so the sum is exact
function shareCosts(trades,costs){
  const base=sumMoney(trades.map(t=>t.gross));let left=costs;
  trades.forEach((t,i)=>{const f=i===trades.length-1?left:roundMoney(base?costs*t.gross/base:0);t.fees=roundMoney(f);left=roundMoney(left-t.fees);});
}
// the label "Data pregão" is often followed by other header cells (note number, page) before the date:
// look for the date after the label, then any date right after the title, then the first date of the text
function noteDate(text){
  const t=stripAccents(text),found=[/data\s+(?:do\s+)?(?:pregao|negociacao)\D{0,40}?(\d{2}\/\d{2}\/\d{4})/i,
    /data\s+(?:do\s+)?(?:pregao|negociacao)[^\n]*\n[^\n]*?(\d{2}\/\d{2}\/\d{4})/i,/data\s+(?:do\s+)?(?:pregao|negociacao)[\s\S]{0,120}?(\d{2}\/\d{2}\/\d{4})/i,/(\d{2}\/\d{2}\/\d{4})/]
    .map(r=>t.match(r)).find(Boolean);
  return found?parseBrDate(found[1]):null;
}
// -> null (not a note) | {error} | {date, trades:[{side:'C'|'V', ticker, name, cls, qty, price, gross, fees}], costs}
export function parseBrokerageNote(text){
  if(!looksLikeBrokerageNote(text))return null;
  const date=noteDate(text);
  if(!date)return {error:'Reconheci uma nota de corretagem, mas não achei a data do pregão.'};
  const trades=[];
  stripAccents(text).split('\n').forEach(line=>{
    const m=line.trim().replace(/\s+/g,' ').match(TRADE_ROW);if(!m)return;
    const spec=m[3].toUpperCase(),ticker=tickerOf(spec),qty=parseAmount(m[4].replace(/\./g,'')),price=parseAmount(m[5]),gross=parseAmount(m[6]);
    if(!(qty>0)||!(price>0)||!(gross>0))return;
    trades.push({side:m[1].toUpperCase(),ticker,name:spec,cls:classOfTicker(ticker,spec),qty,price,gross,fees:0});
  });
  if(!trades.length)return {error:'Reconheci uma nota de corretagem, mas não achei nenhuma linha de compra ou venda.'};
  const costs=costsOf(text);shareCosts(trades,costs);
  return {date,trades,costs};
}

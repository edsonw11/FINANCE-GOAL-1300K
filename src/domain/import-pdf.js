/**
 * domain/import-pdf.js
 * Responsibility: reads the TEXT of a digital PDF (statement or card invoice) into raw entries, and
 * rebuilds text lines from the positioned text pieces a PDF reader returns. Generic and approximate:
 * a line that starts with a date and has a money amount is an entry; there is no per-bank layout.
 * It never reads scanned PDFs or photos (no text to read). Signs the PDF does not print are deduced
 * from words and flagged for the user to confirm.
 */
import { parseAmount, parseBrDate } from '../core/import-values.js';
import { today } from '../core/dates.js';
import { normalizeText } from '../core/text-normalize.js';
const MONTHS={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
const SAME_LINE_TOLERANCE=2.5;
// pieces [{str, x, y}] -> text lines: same baseline = same line, left to right, top to bottom
export function linesFromItems(items){
  const rows=[];
  items.filter(i=>i.str&&i.str.trim()).forEach(i=>{
    let r=rows.find(x=>Math.abs(x.y-i.y)<=SAME_LINE_TOLERANCE);
    if(!r){r={y:i.y,items:[]};rows.push(r);}
    r.items.push(i);
  });
  return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.str.trim()).join(' ').replace(/\s+/g,' '));
}
const NUM_DATE=/^(\d{1,2}[/.-]\d{1,2}(?:[/.-](?:\d{4}|\d{2}))?)(?=\s|$)/;
const NAME_DATE=/^(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zçã]*\.?(?:\s+(?:de\s+)?(\d{4}))?(?=\s|$)/i;
const AMOUNT=/(?:[-−–+]\s*)?(?:R\$\s*)?(?:[-−–+]\s*)?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?[CD]\b)?-?/gi;
const IN_WORDS=/\b(recebid[oa]|deposito|credito em conta|salario|rendimento|resgate|estorno|reembolso)\b/;
const OUT_WORDS=/\b(aplicacao|pagamento|compra|debito|enviad[oa]|saque|tarifa|boleto)\b/;
const CARD_DOC=/fatura|fechamento|limite (total|disponivel)/;
export const looksLikeCardInvoice=text=>CARD_DOC.test(normalizeText(text))&&/cart[aã]o|fatura/i.test(text);
// one line -> {date, rest} when it starts with a date (dd/mm[/yyyy] or "05 NOV [2026]")
function splitDate(line,ref){
  let m=line.match(NUM_DATE);
  if(m){const d=parseBrDate(m[1],ref);return d?{date:d,rest:line.slice(m[0].length).trim()}:null;}
  m=line.match(NAME_DATE);
  if(m){const y=m[3]||ref.slice(0,4);let d=parseBrDate(m[1]+'/'+MONTHS[m[2].toLowerCase()]+'/'+y,ref);
    if(d&&!m[3]&&d>ref)d=parseBrDate(m[1]+'/'+MONTHS[m[2].toLowerCase()]+'/'+(+y-1),ref);
    return d?{date:d,rest:line.slice(m[0].length).trim()}:null;}
  return null;
}
const cleanAmount=s=>s.replace(/[−–]/g,'-').replace(/(\d)([CD])$/i,'$1 $2').replace(/\s*-\s*(?=R?\$?\s*\d)/,'-').trim();
// text of the whole PDF (lines joined by \n) -> {kind, entries}. opts: {today, kind:'auto'|'bank'|'card'}
export function pdfEntries(text,opts){
  opts=opts||{};
  const ref=opts.today||today(),lines=String(text||'').split('\n').map(l=>l.trim()).filter(Boolean);
  const kind=opts.kind&&opts.kind!=='auto'?opts.kind:(looksLikeCardInvoice(text)?'card':'bank');
  const found=[];
  // Some banks print the date once as a heading ("06 NOV 2026" or "06 de novembro de 2026") and list that
  // day's entries below it without a date: those entries take the date of the last heading.
  let section=null;
  const add=(date,text,line,i)=>{
    const am=[...text.matchAll(AMOUNT)];if(!am.length)return false;
    const raw=cleanAmount(am[0][0]),v=parseAmount(raw);if(v===null||v===0)return false;
    const desc=text.slice(0,am[0].index).replace(/\bR\$\s*$/i,'').replace(/[\s|:;-]+$/,'').trim();
    const signed=/^[^\d]*[-+]|\(|-$|\s[CD]$/i.test(raw),negative=v<0,positive=/^\s*\+|\sC$/i.test(raw);
    found.push({date,desc,abs:Math.abs(v),negative,signed,positive,flags:am.length>1&&kind==='bank'?['two-amounts']:[],raw:line,line:i+1});
    return true;
  };
  lines.forEach((line,i)=>{
    const sd=splitDate(line,ref);
    if(sd){
      const heading=!sd.rest||/^(total|saldo)\b/i.test(normalizeText(sd.rest));
      section=heading?sd.date:null;
      if(sd.rest)add(sd.date,sd.rest,line,i);
      return;
    }
    if(section&&!/^(total|saldo)\b/i.test(normalizeText(line)))add(section,line,line,i);
  });
  const docHasNegatives=found.some(f=>f.negative);
  const entries=found.map(f=>{
    let amount,flags=f.flags.slice();
    if(kind==='card')amount=f.negative?-f.abs:f.abs;
    else if(f.negative)amount=-f.abs;
    else if(f.positive)amount=f.abs;
    else{
      const n=normalizeText(f.desc),dir=IN_WORDS.test(n)?'in':OUT_WORDS.test(n)?'out':null;
      if(dir==='in')amount=f.abs;
      else if(dir==='out')amount=-f.abs;
      else if(docHasNegatives)amount=f.abs; // the PDF marks debits with "-", so a plain value is a credit
      else{amount=-f.abs;flags.push('sign-guess');}
    }
    return {date:f.date,desc:f.desc,amount,id:'',raw:f.raw,line:f.line,flags};
  });
  return {kind,entries};
}

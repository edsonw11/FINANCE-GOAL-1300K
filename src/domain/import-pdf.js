/**
 * domain/import-pdf.js
 * Responsibility: reads the TEXT of a digital PDF (statement or card invoice) into raw entries, and
 * rebuilds text lines from the positioned text pieces a PDF reader returns. Generic and approximate:
 * a line that starts with a date and has a money amount is an entry. Layout rules on top: a
 * "Movimentação" block where only the first entry of the day has a date (Santander), descriptions above
 * and below the value line, "Crédito / Débito" columns that give the direction (Bradesco), and groups
 * headed by "Total de entradas / Total de saídas" that go on across pages (Nubank).
 * It never reads scanned PDFs or photos (no text to read). Signs the PDF does not print are deduced
 * from words and flagged for the user to confirm.
 */
import { parseAmount, parseBrDate } from '../core/import-values.js';
import { today } from '../core/dates.js';
import { normalizeText } from '../core/text-normalize.js';
const MONTHS={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
const SAME_LINE_TOLERANCE=2.5;
// gaps measured in font sizes: below SPACE_GAP the pieces are the same word (some PDFs, e.g. Santander, cut
// words into pieces of a few letters); above COLUMN_GAP they are different columns of a table
const SPACE_GAP=0.12,COLUMN_GAP=3;
export const COLUMN_MARK=' | ';
// joins the pieces of one line. Without width/size (old callers, tests) every piece is a word.
function joinPieces(items){
  let out='',prev=null;
  items.forEach(i=>{
    const str=i.str.trim();
    if(prev){
      const measured=prev.w>0&&prev.size>0;
      const gap=measured?i.x-(prev.x+prev.w):null,size=measured?prev.size:0;
      out+=!measured?' ':gap>COLUMN_GAP*size?COLUMN_MARK:gap>SPACE_GAP*size||/^\s/.test(i.str)||/\s$/.test(prev.str)?' ':'';
    }
    out+=str;prev=i;
  });
  return out.replace(/[ ]{2,}/g,' ').trim();
}
// Statements with separate "Crédito" and "Débito" columns (Bradesco, Itaú...) print values without a sign:
// the column says the direction. The header row gives where each column is; a value below it gets " C" or
// " D" (the reader already understands that suffix). Values under "Saldo" are left alone.
const COLUMN_HEADS=[['credit',/^cr[eé]dito/i,'C'],['debit',/^d[eé]bito/i,'D'],['balance',/^saldo/i,null]];
const MONEY_PIECE=/^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const center=i=>i.x+(i.w||0)/2;
// header row -> [{mark, at}] or null; "(R$)" right after a title is part of it
function columnHeads(items){
  const heads=[];
  items.forEach((it,k)=>{const h=COLUMN_HEADS.find(([,re])=>re.test(it.str.trim()));if(!h||!(it.w>0))return;
    const next=items[k+1],end=next&&/^\(/.test(next.str.trim())&&next.x-(it.x+it.w)<(it.size||8)*1.5?next.x+(next.w||0):it.x+it.w;
    heads.push({mark:h[2],kind:h[0],at:(it.x+end)/2});});
  return heads.some(h=>h.kind==='credit')&&heads.some(h=>h.kind==='debit')?heads:null;
}
function markColumns(items,heads){
  return items.map(it=>{
    if(!MONEY_PIECE.test(it.str.trim()))return it;
    const near=heads.reduce((a,h)=>Math.abs(h.at-center(it))<Math.abs(a.at-center(it))?h:a);
    return near.mark?Object.assign({},it,{str:it.str.trim()+' '+near.mark}):it;
  });
}
// pieces [{str, x, y, w?, size?}] -> text lines: same baseline = same line, left to right, top to bottom.
// Blank pieces are dropped (the gap between the others tells where the spaces are).
export function linesFromItems(items){
  const rows=[];
  items.filter(i=>i.str&&i.str.trim()).forEach(i=>{
    let r=rows.find(x=>Math.abs(x.y-i.y)<=SAME_LINE_TOLERANCE);
    if(!r){r={y:i.y,items:[]};rows.push(r);}
    r.items.push(i);
  });
  let heads=null;
  return rows.sort((a,b)=>b.y-a.y).map(r=>{
    const its=r.items.sort((a,b)=>a.x-b.x),h=columnHeads(its);
    if(h){heads=h;return joinPieces(its);}
    return joinPieces(heads?markColumns(its,heads):its);
  });
}
const NUM_DATE=/^(\d{1,2}[/.-]\d{1,2}(?:[/.-](?:\d{4}|\d{2}))?)(?=\s|$)/;
const NAME_DATE=/^(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zçã]*\.?(?:\s+(?:de\s+)?(\d{4}))?(?=\s|$)/i;
const AMOUNT=/(?:[-−–+]\s*)?(?:R\$\s*)?(?:[-−–+]\s*)?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?[CD]\b)?-?/gi;
const IN_WORDS=/\b(recebid[oa]|deposito|remuneracao|credito em conta|salario|rendimento|resgate|estorno|reembolso)\b/;
const OUT_WORDS=/\b(aplicacao|pagamento|compra|debito|enviad[oa]|saque|tarifa|boleto)\b/;
// Santander-like statements: a "Movimentação" heading, then one line per entry where only the first entry of
// the day has a date, and the line below an entry completes its description. Everything else in such a PDF
// (summaries, automatic debits table, indexes) repeats or is not an entry: only the block is read.
const BLOCK_START=/^(movimentacao|movimentacoes|lancamentos|extrato de movimentacao|movimentacao da conta)$/;
const MAX_DESC_LINE=60,PROSE_LINE=70;
// page footers and print codes that sit between entries ("Extrato_P F_A4_Inteligente", "...PIM -", "Pagina: 2/4")
const PAGE_NOISE=/_|\.pim\b|^p\s?agina\b/i;
// Nubank-like groups: "Total de entradas + 4.150,00" / "Total de saídas - 79,90" heads the entries of that
// direction (the entries themselves have no sign)
const GROUP_TOTAL=/^total de (entradas|saidas)\b/;
// the period of the statement in a page header ("01 DE MARÇO DE 2026 a 31 DE MARÇO DE 2026", "01/03/2026 a
// 31/03/2026") is not the date of an entry
const PERIOD_LINE=/^\d{1,2}(?:[/.-]\d{1,2}[/.-]\d{2,4}|\s+(?:de\s+)?[a-zç]+\.?\s+(?:de\s+)?\d{4})\s+(?:a|ate)\s+\d{1,2}\b/i;
// "Quarta, 11 de novembro": a day heading without numbers in the date position (the entries below carry their own date)
const WEEKDAY_HEADING=/^(segunda|terca|quarta|quinta|sexta|sabado|domingo)(-feira)?\b/;
const CARD_DOC=/fatura|fechamento|limite (total|disponivel)/;
// only an invoice prints these; a bank statement may mention "fatura" (an automatic debit of the card bill)
const CARD_STRONG=/\b(pagamento minimo|total (da|desta) fatura|valor (total )?da fatura|fechamento da fatura|limite (total|disponivel))\b/;
const BANK_DOC=/\b(extrato|conta corrente|saldo anterior|saldo do dia|saldos por periodo)\b/;
export function looksLikeCardInvoice(text){
  const n=normalizeText(text);
  if(CARD_STRONG.test(n))return true;
  return CARD_DOC.test(n)&&/cart[aã]o|fatura/i.test(text)&&!BANK_DOC.test(n);
}
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
const plainLine=line=>normalizeText(line.split(COLUMN_MARK).join(' '));
const hasAmount=line=>new RegExp(AMOUNT.source,'i').test(line);
// the first two amounts sit in different measured columns (value, then balance): no doubt about which is the value
const inColumns=(text,am)=>text.slice(am[0].index+am[0][0].length,am[1].index).includes(COLUMN_MARK.trim());
const cleanAmount=s=>s.replace(/[−–]/g,'-').replace(/(\d)([CD])$/i,'$1 $2').replace(/\s*-\s*(?=R?\$?\s*\d)/,'-').trim();
// text of the whole PDF (lines joined by \n) -> {kind, entries}. opts: {today, kind:'auto'|'bank'|'card'}
export function pdfEntries(text,opts){
  opts=opts||{};
  const ref=opts.today||today(),lines=String(text||'').split('\n').map(l=>l.trim()).filter(Boolean);
  const kind=opts.kind&&opts.kind!=='auto'?opts.kind:(looksLikeCardInvoice(text)?'card':'bank');
  const found=[];
  // Some banks print the date once as a heading ("06 NOV 2026" or "06 de novembro de 2026") and list that
  // day's entries below it without a date: those entries take the date of the last heading.
  let section=null,groupDir=null;
  // the direction of the group this line belongs to ("Total de saídas" above it), if any
  const noteGroup=text=>{const g=normalizeText(text).match(GROUP_TOTAL);if(g)groupDir=g[1]==='entradas'?'in':'out';};
  const add=(date,text,line,i)=>{
    const am=[...text.matchAll(AMOUNT)];if(!am.length)return false;
    const raw=cleanAmount(am[0][0]),v=parseAmount(raw);if(v===null||v===0)return false;
    // a document number column ("Docto. 4674934") is not part of the description
    const desc=text.slice(0,am[0].index).replace(/\bR\$\s*$/i,'').replace(/[\s|:;-]+$/,'').split(COLUMN_MARK).join(' ').replace(/(^|\s)\d{5,}(?=\s|$)/g,' ').replace(/^[\s|]+/,'').replace(/\s+/g,' ').trim();
    const signed=/^[^\d]*[-+]|\(|-$|\s[CD]$/i.test(raw),negative=v<0,positive=/^\s*\+|\sC$/i.test(raw);
    found.push({date,desc,abs:Math.abs(v),negative,signed,positive,dir:GROUP_TOTAL.test(normalizeText(desc))?null:groupDir,flags:am.length>1&&kind==='bank'&&!inColumns(text,am)?['two-amounts']:[],raw:line,line:i+1});
    return true;
  };
  const blocks=lines.some(l=>BLOCK_START.test(plainLine(l)));
  let inBlock=false,lastDate=null,lastEntry=null;
  const readBlock=(line,i)=>{
    if(BLOCK_START.test(plainLine(line))){inBlock=true;lastDate=null;lastEntry=null;groupDir=null;return;}
    if(PERIOD_LINE.test(line))return;
    // a group total re-opens the block: the movements go on after a page footer (Nubank)
    // a group total, or an entry while a group is open, re-opens the block: the movements go on after a page
    // footer (Nubank)
    if(!inBlock&&lastDate&&(groupDir&&hasAmount(line)||GROUP_TOTAL.test(plainLine(line).replace(/^\d{1,2} [a-z]{3} \d{4} /,''))))inBlock=true;
    if(!inBlock)return;
    if(!hasAmount(line)&&line.length>=PROSE_LINE){inBlock=false;lastEntry=null;return;} // a paragraph of text ends the block
    const sd=splitDate(line,ref);
    if(sd){lastDate=sd.date;groupDir=null;if(sd.rest)noteGroup(sd.rest);lastEntry=sd.rest&&add(sd.date,sd.rest,line,i)?found[found.length-1]:null;return;}
    noteGroup(line);
    if(lastDate&&hasAmount(line)){lastEntry=add(lastDate,line,line,i)?found[found.length-1]:null;return;}
    if(lastEntry&&line.length<=MAX_DESC_LINE&&!PAGE_NOISE.test(line)&&!/^(total|saldo)\b/.test(plainLine(line))){lastEntry.desc=(lastEntry.desc+' '+line.split(COLUMN_MARK).join(' ')).trim();lastEntry.raw+=' / '+line;}
  };
  // Some layouts print the description on the line above the date line and the other party on the line
  // below ("Pix enviado" / "06/11/2026 | -R$ 30.000,00" / "Fulano"): a dated entry without its own text takes
  // the lines kept since the last entry, and the next short line completes it.
  // Bradesco-like tables: the date only on the first entry of the day (the next ones keep it), the
  // description above the value line and "DES:/REM: <name> dd/mm" below it.
  let pending=[],completes=null,dayDate=null;
  const descLine=line=>!hasAmount(line)&&line.length<=MAX_DESC_LINE&&!line.includes(COLUMN_MARK.trim())&&!PAGE_NOISE.test(line);
  const tableRow=line=>/\d,\d{2} [CD]\b/.test(line)||([...line.matchAll(AMOUNT)].length>=2&&line.includes(COLUMN_MARK.trim()));
  const addition=line=>line.replace(/^(des|rem|dest|favorecido):\s*/i,'').replace(/\s+\d{2}\/\d{2}$/,'').trim();
  const takeEntry=(date,text,line,i)=>{
    if(!add(date,text,line,i))return false;
    const e=found[found.length-1];if(!/[a-z]/i.test(e.desc))e.desc='';
    if(!e.desc&&pending.length){e.desc=pending.join(' ');e.raw=pending.join(' / ')+' / '+e.raw;}
    completes=text.slice(0,text.search(/\d/)).replace(/[\s|R$-]/g,'')?null:e;
    return true;
  };
  const readAll=(line,i)=>{
    if(PERIOD_LINE.test(line))return;
    const sd=splitDate(line,ref);
    if(sd){groupDir=null;noteGroup(sd.rest||'');
      const heading=!sd.rest||/^(total|saldo)\b/i.test(normalizeText(sd.rest));
      section=heading?sd.date:null;completes=null;dayDate=sd.date;
      if(sd.rest)takeEntry(sd.date,sd.rest,line,i);
      pending=[];
      return;
    }
    if(WEEKDAY_HEADING.test(plainLine(line))){pending=[];completes=null;return;}
    noteGroup(line);
    if(completes&&descLine(line)){const a=addition(line);completes.desc=(completes.desc+' '+a).trim();completes.raw+=' / '+line;completes=null;return;}
    completes=null;
    if(/^(total|saldo)\b/i.test(normalizeText(line))){pending=[];return;}
    if(section){if(add(section,line,line,i))return;}
    else if(dayDate&&tableRow(line)&&takeEntry(dayDate,line,line,i)){pending=[];return;}
    if(descLine(line))pending=pending.slice(-1).concat(line);
    else if(!hasAmount(line))pending=[]; // a header or a page line: what was kept above does not belong to the next entry
  };
  if(blocks)lines.forEach(readBlock);
  if(!found.length)lines.forEach(readAll); // no block, or a block this reader did not understand: read every line
  // group totals and balances do not tell how the entries are signed
  const docHasNegatives=found.some(f=>f.negative&&!/^(total|saldo)\b/.test(normalizeText(f.desc)));
  const entries=found.map(f=>{
    let amount,flags=f.flags.slice();
    if(kind==='card')amount=f.negative?-f.abs:f.abs;
    else if(f.negative)amount=-f.abs;
    else if(f.positive)amount=f.abs;
    else if(f.dir)amount=f.dir==='in'?f.abs:-f.abs; // under "Total de entradas / saídas"
    else{
      // the PDF marks debits with "-", so a plain value is a credit (the sign beats the words)
      const n=normalizeText(f.desc),dir=docHasNegatives?'in':IN_WORDS.test(n)?'in':OUT_WORDS.test(n)?'out':null;
      if(dir==='in')amount=f.abs;
      else if(dir==='out')amount=-f.abs;
      else{amount=-f.abs;flags.push('sign-guess');}
    }
    return {date:f.date,desc:f.desc,amount,id:'',raw:f.raw,line:f.line,flags};
  });
  return {kind,entries};
}

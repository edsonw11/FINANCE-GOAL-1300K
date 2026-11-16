/**
 * domain/import-csv.js
 * Responsibility: reads a CSV file into raw entries {date, desc, amount, id, raw, line}: finds the
 * delimiter, splits quoted cells, guesses which column is the date / description / amount (or
 * debit + credit columns), and applies a column mapping chosen by the user. No business rules here.
 */
import { parseAmount, parseBrDate } from '../core/import-values.js';
import { normalizeText } from '../core/text-normalize.js';
const DELIMITERS=[';','\t',','];
function pickDelimiter(line){
  let best=',',max=0;
  for(const d of DELIMITERS){let n=0,q=false;for(const c of line){if(c==='"')q=!q;else if(c===d&&!q)n++;}if(n>max){max=n;best=d;}}
  return best;
}
// text -> rows of cells; empty rows are dropped; quotes may contain the delimiter, line breaks and ""
export function parseCsv(text){
  text=String(text||'').replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/).find(l=>l.trim())||'',d=pickDelimiter(first),rows=[];
  let row=[],cell='',q=false;
  const endCell=()=>{row.push(cell.trim());cell='';};
  const endRow=()=>{endCell();if(row.some(c=>c!==''))rows.push(row);row=[];};
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;continue;}
    if(c==='"')q=true;else if(c===d)endCell();else if(c==='\n')endRow();else if(c!=='\r')cell+=c;}
  if(cell!==''||row.length)endRow();
  return rows;
}
const NAMES={
  date:/^(data|date|dt|data (da |de )?(transacao|lancamento|compra|movimentacao|operacao|pagamento))$/,
  desc:/(descri|historico|titulo|title|estabelecimento|memo|detalhe|beneficiario|favorecido|lancamento|nome)/,
  value:/^(valor|value|amount|quantia|montante|valor \(?r\$?\)?)$/,
  debit:/(debito|saida|saidas|despesa|debit)/,
  credit:/(credito|entrada|entradas|receita|credit)/,
  id:/^(id|identificador|codigo|fitid|doc(?:umento)?|nsu|n doc(?:umento)?|numero)$/};
const KIND_WORDS=/^(d|c|debito|credito|saida|entrada|debit|credit)$/;
const colName=h=>normalizeText(h);
// which column holds what. hasHeader=false: guessed from the content of the first rows
export function detectCsvMapping(rows){
  const m={hasHeader:false,date:-1,desc:-1,value:-1,debit:-1,credit:-1,kind:-1,id:-1};
  if(!rows.length)return {...m,complete:false};
  const r0=rows[0],looksData=r0.some(c=>parseBrDate(c)&&c.length>=8);
  m.hasHeader=!looksData;
  const body=rows.slice(m.hasHeader?1:0,(m.hasHeader?1:0)+20),width=Math.max(...rows.slice(0,20).map(r=>r.length));
  if(m.hasHeader){
    const h=r0.map(colName),free=i=>!['date','desc','value','debit','credit','id'].some(k=>m[k]===i);
    for(const k of ['date','value','debit','credit','id'])m[k]=h.findIndex((x,i)=>free(i)&&NAMES[k].test(x));
    m.desc=h.findIndex((x,i)=>free(i)&&NAMES.desc.test(x)&&!NAMES.date.test(x));
    if(m.debit>=0&&m.credit>=0&&m.debit===m.credit)m.credit=-1;
  }
  // content based fallbacks (also for files without a header)
  const col=i=>body.map(r=>r[i]||'').filter(Boolean);
  const share=(i,f)=>{const c=col(i);return c.length?c.filter(f).length/c.length:0;};
  if(m.date<0)for(let i=0;i<width;i++)if(share(i,x=>!!parseBrDate(x))>=0.8){m.date=i;break;}
  if(m.value<0&&m.debit<0&&m.credit<0)for(let i=width-1;i>=0;i--)if(i!==m.date&&share(i,x=>/\d/.test(x)&&parseAmount(x)!==null&&!parseBrDate(x))>=0.8){m.value=i;break;}
  if(m.desc<0){let best=-1,len=0;for(let i=0;i<width;i++){if([m.date,m.value,m.debit,m.credit,m.id].includes(i))continue;
    const avg=col(i).reduce((a,x)=>a+x.length,0)/Math.max(1,col(i).length);if(avg>len&&share(i,x=>/[a-zA-Z]/.test(x))>=0.6){len=avg;best=i;}}m.desc=best;}
  for(let i=0;i<width&&m.kind<0;i++)if(![m.date,m.desc,m.value,m.debit,m.credit,m.id].includes(i)&&col(i).length&&share(i,x=>KIND_WORDS.test(normalizeText(x)))>=0.8)m.kind=i;
  m.complete=m.date>=0&&(m.value>=0||m.debit>=0||m.credit>=0);
  return m;
}
const kindSign=t=>{const w=normalizeText(t);return /^(d|debito|saida|debit)$/.test(w)?-1:/^(c|credito|entrada|credit)$/.test(w)?1:0;};
// signed amount of a row: "value" column, or credit - debit, or a D/C column giving the sign
function rowAmount(r,m){
  if(m.value>=0){let a=parseAmount(r[m.value]);if(a===null)return null;
    if(m.kind>=0){const k=kindSign(r[m.kind]);if(k)a=k*Math.abs(a);}return a;}
  const deb=m.debit>=0?parseAmount(r[m.debit]):null,cre=m.credit>=0?parseAmount(r[m.credit]):null;
  if(deb&&Math.abs(deb)>0)return -Math.abs(deb);
  if(cre&&Math.abs(cre)>0)return Math.abs(cre);
  return deb===null&&cre===null?null:0;
}
// rows + mapping -> {entries, skipped:{noDate, noValue, empty}}. today (ISO) completes dates without a year
export function csvEntries(rows,m,today){
  const out={entries:[],skipped:{noDate:0,noValue:0,empty:0}};
  rows.slice(m.hasHeader?1:0).forEach((r,i)=>{
    const line=i+(m.hasHeader?2:1),date=m.date>=0?parseBrDate(r[m.date],today):null;
    if(!date){out.skipped.noDate++;return;}
    const amount=rowAmount(r,m);
    if(amount===null){out.skipped.noValue++;return;}
    if(amount===0){out.skipped.empty++;return;}
    out.entries.push({date,desc:m.desc>=0?(r[m.desc]||'').replace(/\s+/g,' ').trim():'',amount,id:m.id>=0?(r[m.id]||''):'',raw:r.join(' | '),line});
  });
  return out;
}

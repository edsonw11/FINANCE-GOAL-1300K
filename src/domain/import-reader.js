/**
 * domain/import-reader.js
 * Responsibility: turns the text of a file into import drafts, choosing the reader by content (OFX or
 * CSV) or extension (PDF: the caller passes the text it extracted), validating size and kind, and marking duplicates. Reading never saves anything.
 * readImportFile({name, size, text}, opts) -> {ok:false, error} | {ok:true, format, kind, drafts, ...}
 * opts: {kind:'auto'|'bank'|'card', invert:boolean, mapping:object|null, today:'yyyy-mm-dd'}
 */
import { textHash } from '../core/text-normalize.js';
import { today } from '../core/dates.js';
import { S } from './store.js';
import { detectCsvMapping, csvEntries, parseCsv } from './import-csv.js';
import { looksLikeOfx, parseOfx } from './import-ofx.js';
import { pdfEntries } from './import-pdf.js';
import { buildDrafts } from './import-draft.js';
import { markDuplicates } from './import-duplicates.js';
import { markTransferPairs } from './transfers.js';
import { ownNames } from './own-names.js';
export const IMPORT_LIMITS={maxBytes:2*1024*1024,maxPdfBytes:10*1024*1024,maxPdfPages:40,maxEntries:3000};
export const SUPPORTED_EXTENSIONS=['csv','ofx','qfx','txt','pdf'];
export const SUPPORTED_TEXT='CSV, OFX e PDF digital';
const NOT_YET={jpg:'foto',jpeg:'foto',png:'imagem',heic:'foto',heif:'foto',webp:'imagem',xls:'planilha Excel',xlsx:'planilha Excel',ods:'planilha'};
const CARD_HINT=/fatura|cartao|cartão|invoice|credit/i;
const extOf=n=>(String(n||'').match(/\.([a-z0-9]+)$/i)||[null,''])[1].toLowerCase();
const fail=error=>({ok:false,error});
export function readImportFile(file,opts){
  opts=opts||{};
  const ext=extOf(file.name),text=String(file.text||'');
  if(NOT_YET[ext])return fail(`Ainda não leio ${NOT_YET[ext]} (.${ext}). Hoje o app lê ${SUPPORTED_TEXT}. No app do banco, exporte o extrato ou a fatura em CSV ou OFX.`);
  if(ext&&!SUPPORTED_EXTENSIONS.includes(ext))return fail(`Formato .${ext} não é suportado. Use ${SUPPORTED_TEXT}.`);
  const limit=ext==='pdf'?IMPORT_LIMITS.maxPdfBytes:IMPORT_LIMITS.maxBytes;
  if((file.size||text.length)>limit)return fail('Arquivo grande demais (máximo '+limit/1024/1024+' MB). Exporte um período menor.');
  if(!text.trim())return fail(ext==='pdf'?'Este PDF não tem texto para ler: parece escaneado ou é uma foto. Baixe a versão digital no banco ou exporte CSV/OFX.':'O arquivo está vazio.');
  if(text.includes('\u0000'))return fail('Este arquivo não é um texto legível (parece binário ou protegido). Use CSV ou OFX.');
  const now=opts.today||today(),format=ext==='pdf'?'pdf':looksLikeOfx(text)?'ofx':'csv',fileHash=textHash(text);
  let entries,kind,mapping=null,rows=null,accountId='',skipped={noDate:0,noValue:0,empty:0},unreadable=0;
  if(format==='pdf'){
    const o=pdfEntries(text,{today:now,kind:opts.kind});entries=o.entries;kind=o.kind;
    if(!entries.length)return fail('Não encontrei linhas com data e valor neste PDF. O layout pode ser diferente do que o app entende: tente o CSV/OFX do banco.');
  }else if(format==='ofx'){
    const o=parseOfx(text);entries=o.entries;accountId=o.accountId;unreadable=o.unreadable;
    kind=opts.kind&&opts.kind!=='auto'?opts.kind:o.kind;
    if(!o.found)return fail('Não encontrei lançamentos neste OFX.');
  }else{
    rows=parseCsv(text);
    if(rows.length<2&&!rows.length)return fail('Não consegui ler linhas neste arquivo.');
    mapping=opts.mapping||detectCsvMapping(rows);
    kind=opts.kind&&opts.kind!=='auto'?opts.kind:(CARD_HINT.test(file.name||'')?'card':'bank');
    if(!mapping.complete)return {ok:false,needsMapping:true,error:'Não identifiquei as colunas de data e valor. Escolha-as abaixo.',format,kind,rows,mapping,fileName:file.name,fileHash};
    const r=csvEntries(rows,mapping,now);entries=r.entries;skipped=r.skipped;
  }
  if(entries.length>IMPORT_LIMITS.maxEntries)return fail(`Arquivo com ${entries.length} lançamentos (máximo ${IMPORT_LIMITS.maxEntries}). Exporte um período menor.`);
  if(!entries.length)return format==='csv'?{ok:false,needsMapping:true,error:'Não encontrei lançamentos com data e valor. Confira as colunas escolhidas.',format,kind,rows,mapping,fileName:file.name,fileHash}:fail('Não encontrei lançamentos neste arquivo.');
  const {drafts,dropped}=buildDrafts(entries,{format,kind,invert:!!opts.invert,accountId,ownNames:ownNames()});
  markDuplicates(drafts);
  markTransferPairs(drafts);
  drafts.forEach(d=>{if(d.dup)d.selected=false;});
  const before=(S.imports||[]).find(i=>i.hash===fileHash)||null;
  return {ok:true,format,kind,fileName:file.name||'arquivo',fileHash,rows,mapping,drafts,dropped,skipped,unreadable,alreadyImported:before};
}

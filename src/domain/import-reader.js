/**
 * domain/import-reader.js
 * Responsibility: turns the text of a file into import drafts, choosing the reader by content (OFX or
 * CSV) or extension (PDF: the caller passes the text it extracted), validating size and kind, and marking duplicates. Reading never saves anything.
 * readImportFile({name, size, text}, opts) -> {ok:false, error} | {ok:true, format, kind, drafts, ...}
 * opts: {kind:'auto'|'bank'|'card', invert:boolean, mapping:object|null, today:'yyyy-mm-dd'}
 */
import { textHash } from '../core/text-normalize.js';
import { today } from '../core/dates.js';
import { t } from '../core/i18n.js';
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
export const supportedText=()=>t('imp.reader.supported');
// kind of file not read yet: the key of the word that names it in the message
const NOT_YET={jpg:'imp.reader.kindPhoto',jpeg:'imp.reader.kindPhoto',png:'imp.reader.kindImage',heic:'imp.reader.kindPhoto',heif:'imp.reader.kindPhoto',webp:'imp.reader.kindImage',xls:'imp.reader.kindExcel',xlsx:'imp.reader.kindExcel',ods:'imp.reader.kindSheet'};
const CARD_HINT=/fatura|cartao|cartão|invoice|credit/i;
const extOf=n=>(String(n||'').match(/\.([a-z0-9]+)$/i)||[null,''])[1].toLowerCase();
const fail=error=>({ok:false,error});
export function readImportFile(file,opts){
  opts=opts||{};
  const ext=extOf(file.name),text=String(file.text||'');
  if(NOT_YET[ext])return fail(t('imp.reader.notYet',{kind:t(NOT_YET[ext]),ext,supported:supportedText()}));
  if(ext&&!SUPPORTED_EXTENSIONS.includes(ext))return fail(t('imp.reader.unsupported',{ext,supported:supportedText()}));
  const limit=ext==='pdf'?IMPORT_LIMITS.maxPdfBytes:IMPORT_LIMITS.maxBytes;
  if((file.size||text.length)>limit)return fail(t('imp.reader.tooBig',{max:limit/1024/1024}));
  if(!text.trim())return fail(ext==='pdf'?t('imp.reader.pdfNoText'):t('imp.reader.empty'));
  if(text.includes('\u0000'))return fail(t('imp.reader.binary'));
  const now=opts.today||today(),format=ext==='pdf'?'pdf':looksLikeOfx(text)?'ofx':'csv',fileHash=textHash(text);
  let entries,kind,mapping=null,rows=null,accountId='',skipped={noDate:0,noValue:0,empty:0},unreadable=0;
  if(format==='pdf'){
    const o=pdfEntries(text,{today:now,kind:opts.kind});entries=o.entries;kind=o.kind;
    if(!entries.length)return fail(t('imp.reader.pdfNoRows'));
  }else if(format==='ofx'){
    const o=parseOfx(text);entries=o.entries;accountId=o.accountId;unreadable=o.unreadable;
    kind=opts.kind&&opts.kind!=='auto'?opts.kind:o.kind;
    if(!o.found)return fail(t('imp.reader.ofxNone'));
  }else{
    rows=parseCsv(text);
    if(rows.length<2&&!rows.length)return fail(t('imp.reader.noRows'));
    mapping=opts.mapping||detectCsvMapping(rows);
    kind=opts.kind&&opts.kind!=='auto'?opts.kind:(CARD_HINT.test(file.name||'')?'card':'bank');
    if(!mapping.complete)return {ok:false,needsMapping:true,error:t('imp.reader.noColumns'),format,kind,rows,mapping,fileName:file.name,fileHash};
    const r=csvEntries(rows,mapping,now);entries=r.entries;skipped=r.skipped;
  }
  if(entries.length>IMPORT_LIMITS.maxEntries)return fail(t('imp.reader.tooMany',{count:entries.length,max:IMPORT_LIMITS.maxEntries}));
  if(!entries.length)return format==='csv'?{ok:false,needsMapping:true,error:t('imp.reader.csvNone'),format,kind,rows,mapping,fileName:file.name,fileHash}:fail(t('imp.reader.fileNone'));
  const {drafts,dropped}=buildDrafts(entries,{format,kind,invert:!!opts.invert,accountId,ownNames:ownNames()});
  markDuplicates(drafts);
  markTransferPairs(drafts);
  drafts.forEach(d=>{if(d.dup)d.selected=false;});
  const before=(S.imports||[]).find(i=>i.hash===fileHash)||null;
  return {ok:true,format,kind,fileName:file.name||t('imp.reader.fileFallback'),fileHash,rows,mapping,drafts,dropped,skipped,unreadable,alreadyImported:before};
}

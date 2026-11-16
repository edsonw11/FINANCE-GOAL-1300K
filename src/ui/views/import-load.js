/**
 * ui/views/import-load.js
 * Responsibility: from a chosen File to a review session: reads the bytes as text (a custody statement becomes a balance update instead of drafts; UTF-8, or
 * Windows-1252 as many Brazilian bank files are; a PDF goes through pdf-text.js), asks the domain to read it, and starts the session.
 * Also re-reads the same file with other options (kind of file, signs, columns). Nothing is saved.
 * Ignores the answer if the user closed the panel while the file was being read.
 */
import { today } from '../../core/dates.js';
import { IMPORT_LIMITS, readImportFile } from '../../domain/import-reader.js';
import { parseCustody } from '../../domain/import-custody.js';
import { suggestAccount } from '../../domain/import-account.js';
import { beginCustody, beginSession, importState } from './import-session.js';
import { pdfText } from './pdf-text.js';
const PDF_TIMEOUT_MS=45000,SAMPLE_LINES=30; // first lines of the PDF text, shown when it cannot be read, to help adjust the reader
// a reader that never answers (old phone browser) must not leave the screen waiting forever
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('O leitor de PDF não respondeu neste aparelho. Use o CSV/OFX do banco ou abra o app no computador.')),ms))]);
export async function fileText(file){
  const buf=await file.arrayBuffer();
  try{return new TextDecoder('utf-8',{fatal:true}).decode(buf);}
  catch(e){return new TextDecoder('windows-1252').decode(buf);}
}
// -> {error} | {session}   (error is a message for the user)
// opts.kind: 'invest' when the import was started from Investimentos (money in = contribution)
export async function loadImportFile(file,opts){
  const token=importState.token;
  const isPdf=/\.pdf$/i.test(file.name)||file.type==='application/pdf',tooBig=file.size>(isPdf?IMPORT_LIMITS.maxPdfBytes:IMPORT_LIMITS.maxBytes);
  let text='';
  try{text=tooBig?'':isPdf?await withTimeout(pdfText(file),PDF_TIMEOUT_MS):await fileText(file);}
  catch(e){return {error:isPdf&&e.message?e.message:'Não consegui ler o arquivo. Tente de novo ou exporte outro.'};}
  if(token!==importState.token)return {cancelled:true};
  const custody=isPdf?parseCustody(text):null;
  if(custody&&custody.error)return {error:custody.error};
  if(custody)return {session:beginCustody(custody,suggestAccount('nubank'),{name:file.name,size:file.size})};
  const info={name:file.name,size:file.size,text};
  const kind=opts&&opts.kind||'auto';
  const read=readImportFile(info,{today:today(),kind});
  if(!read.ok&&!read.needsMapping)return {error:read.error,sample:isPdf?text.split('\n').slice(0,SAMPLE_LINES).join('\n'):''};
  const s=beginSession(read,{kind:read.kind,invert:false});
  s.file=info;
  return {session:s};
}
// same file, other options. Drafts are rebuilt, so the edits made so far are discarded
export function rereadSession(patch){
  const s=importState.session;if(!s||!s.file)return;
  s.opts={...s.opts,...patch};
  const read=readImportFile(s.file,{today:today(),kind:s.opts.kind,invert:s.opts.invert,mapping:s.opts.mapping||null});
  s.read=read;s.drafts=read.drafts||[];s.openId=null;s.phase=read.ok?'review':'mapping';
}

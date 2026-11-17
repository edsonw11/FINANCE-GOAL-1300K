/**
 * ui/views/import-session.js
 * Responsibility: the import being reviewed right now (kept in memory only, never stored): the file
 * that was read, its drafts, which row is open for editing, and the edits the user makes. Edits only
 * touch drafts; saved data is changed by domain/import-commit.js after the user confirms.
 */
import { today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { IMPORT_TYPE } from '../../domain/import-classify.js';
import { blankDraft, isSaveable } from '../../domain/import-draft.js';
import { suggestAccount } from '../../domain/import-account.js';
import { markDuplicates } from '../../domain/import-duplicates.js';
const KEY='metaapp.trace';
const saved=()=>{try{return JSON.parse(sessionStorage.getItem(KEY))||[];}catch(e){return [];}};
export const importState={session:null,token:0,trace:saved()};
// short log of the steps, shown under "Detalhes técnicos" so a problem on a phone can be reported precisely
export const trace=msg=>{importState.trace.push(new Date().toTimeString().slice(0,8)+' '+msg);importState.trace=importState.trace.slice(-12);try{sessionStorage.setItem(KEY,JSON.stringify(importState.trace));}catch(e){/* private mode */}};
// "Apagar tudo" also forgets the log (it names the files that were read)
export function clearTrace(){importState.trace=[];try{sessionStorage.removeItem(KEY);}catch(e){/* private mode */}}
// read: result of readImportFile (ok or needsMapping). opts: the options used to read it
export function beginSession(read,opts){
  importState.token++;
  importState.session={read,opts:{kind:'auto',invert:false,...opts},drafts:read.drafts||[],openId:null,phase:read.ok?'review':'mapping',busy:false,result:null};
  return importState.session;
}
// a custody statement: not drafts, a balance to apply to one account
export function beginCustody(custody,acc,file){
  importState.token++;
  importState.session={phase:'custody',custody,acc,file,drafts:[],read:{ok:true,drafts:[]},openId:null,busy:false,result:null};
  return importState.session;
}
// a brokerage note: trades to review (kept here, saved only after the user confirms)
export function beginNote(note,file){
  importState.token++;
  importState.session={phase:'note',note,file,drafts:[],read:{ok:true,drafts:[]},openId:null,busy:false,result:null};
  return importState.session;
}
export function endSession(){trace('sessão encerrada');importState.token++;importState.session=null;}
export const draftById=id=>importState.session&&importState.session.drafts.find(d=>d.id===id)||null;
const NUMBER_FIELDS=['value'];
// applies the edited fields of one draft; keeps type/source/selection consistent and re-checks duplicates
export function patchDraft(id,patch){
  const s=importState.session,d=draftById(id);if(!s||!d)return null;
  const hadDup=!!d.dup,prevType=d.type;
  Object.keys(patch).forEach(k=>{d[k]=NUMBER_FIELDS.includes(k)?parseMoney(patch[k]):patch[k];});
  if(d.type!==IMPORT_TYPE.expense&&d.fonte==='cartao')d.fonte='caixa';
  if(d.type===IMPORT_TYPE.contribution&&!d.acc)d.acc=suggestAccount(d.desc);
  if(d.type!==prevType){
    if(!isSaveable(d)){d.selected=false;}
    else if(prevType===IMPORT_TYPE.ignore||prevType===IMPORT_TYPE.ownTransfer){d.selected=true;d.reason=null;}
    if(d.type!==IMPORT_TYPE.ownTransfer)d.fixPair=false;
  }
  markDuplicates(s.drafts);
  if(!hadDup&&d.dup)d.selected=false; // it became a possible duplicate: the user decides again
  return d;
}
export function removeDraft(id){
  const s=importState.session;if(!s)return;
  s.drafts=s.drafts.filter(d=>d.id!==id);
  if(s.openId===id)s.openId=null;
}
export function addManualDraft(){
  const s=importState.session,d=blankDraft({date:today(),selected:true});
  s.drafts.push(d);s.openId=d.id;return d;
}
export function setAllSelected(flag){
  importState.session.drafts.forEach(d=>{d.selected=flag&&isSaveable(d);});
}
// drops the drafts that were saved, keeps the ones that still need attention
export function keepUnsaved(items){
  const s=importState.session,saved=new Set(items.filter(i=>i.status==='saved'||i.status==='skipped').map(i=>i.id));
  s.drafts=s.drafts.filter(d=>!saved.has(d.id));
}


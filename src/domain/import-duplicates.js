/**
 * domain/import-duplicates.js
 * Responsibility: finds drafts that may already exist. A "confirmed" duplicate has a key that was
 * already imported (same bank id, or same date + value + text), or repeats a bank id inside the file.
 * A "possible" one is a manual record with the same type and value on the same day (or one day apart
 * with a shared word): similar, not proven, since two equal purchases on one day can be real.
 * Only marks drafts (draft.dup); it never changes or removes saved records.
 */
import { formatDateBR, daysBetween } from '../core/dates.js';
import { significantWords } from '../core/text-normalize.js';
import { t } from '../core/i18n.js';
import { S } from './store.js';
import { SAVEABLE } from './import-draft.js';
export const DUP_LEVEL={confirmed:'confirmed',possible:'possible'};
const cents=v=>Math.round(v*100);
const shareWord=(a,b)=>{const w=new Set(significantWords(a));return significantWords(b).some(x=>w.has(x));};
// same day = possible duplicate; one day apart only when the descriptions share a word (bank dates drift)
function matchExisting(d,list){
  for(const t of list){
    if(t.type!==d.type)continue;
    const gap=Math.abs(daysBetween(t.date,d.date));
    if(gap===0||(gap===1&&shareWord(t.desc,d.desc)))return t;
  }
  return null;
}
export function markDuplicates(drafts){
  const byCents={},byKey={};
  S.tx.forEach(t=>{
    if(t.type!=='despesa'&&t.type!=='receita')return;
    (byCents[cents(t.value)]||(byCents[cents(t.value)]=[])).push(t);
    if(t.imp&&!byKey[t.imp])byKey[t.imp]=t;
  });
  const inFile=new Set();
  drafts.forEach(d=>{
    d.dup=null;
    if(d.key&&byKey[d.key]){d.dup={level:DUP_LEVEL.confirmed,text:t('imp.dup.already',{desc:byKey[d.key].desc||byKey[d.key].cat,date:formatDateBR(byKey[d.key].date)})};}
    else if(d.key&&inFile.has(d.key)){d.dup={level:DUP_LEVEL.confirmed,text:t('imp.dup.inFile')};}
    else if(SAVEABLE.includes(d.type)&&d.date){
      const hit=matchExisting(d,byCents[cents(d.value)]||[]);
      if(hit)d.dup={level:DUP_LEVEL.possible,text:t('imp.dup.similar',{desc:hit.desc||hit.cat,date:formatDateBR(hit.date)})};
    }
    if(d.key)inFile.add(d.key);
  });
}

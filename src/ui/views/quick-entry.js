/**
 * ui/views/quick-entry.js
 * Responsibility: the "Lançamento rápido" field. The sentence is understood by domain/quick-entry.js
 * and opens the normal form already filled, with a note about what was understood and what is still
 * missing. It never saves by itself: the user reviews and taps save.
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
import { today } from '../../core/dates.js';
import { parseQuickEntry } from '../../domain/quick-entry.js';
import { toast } from '../toast.js';
import { openTxForm } from './transaction-form-sheet.js';
const MISSING_KEY={type:'tx.quick.missType',value:'tx.quick.missValue',date:'tx.quick.missDate',cat:'tx.quick.missCategory',acc:'tx.quick.missAccount'};
export function noteOf(r){
  const missing=r.missing.map(m=>MISSING_KEY[m]?t(MISSING_KEY[m]):'').filter(Boolean);
  return t('tx.quick.understood',{summary:r.summary})+(missing.length?' '+t('tx.quick.toConfirm',{list:missing.join(', ')}):'')+(r.notes.length?' '+r.notes.join(' '):'');
}
export function bindQuickEntry(){
  $('qeForm').onsubmit=e=>{
    e.preventDefault();
    const text=$('qeText').value.trim();
    if(!text){toast(t('tx.quick.empty'));return;}
    const r=parseQuickEntry(text,today());
    openTxForm({type:r.type,prefill:{value:r.value,date:r.date,desc:r.desc,cat:r.cat,fonte:r.fonte,acc:r.acc},note:noteOf(r)});
    $('qeText').value='';
  };
}

/**
 * ui/views/quick-entry.js
 * Responsibility: the "Lançamento rápido" field. The sentence is understood by domain/quick-entry.js
 * and opens the normal form already filled, with a note about what was understood and what is still
 * missing. It never saves by itself: the user reviews and taps save.
 */
import { $ } from '../../core/dom.js';
import { today } from '../../core/dates.js';
import { parseQuickEntry } from '../../domain/quick-entry.js';
import { toast } from '../toast.js';
import { openTxForm } from './transaction-form-sheet.js';
const MISSING={type:'tipo (despesa ou receita)',value:'valor',date:'data',cat:'categoria',acc:'onde investir'};
export function noteOf(r){
  const missing=r.missing.map(m=>MISSING[m]).filter(Boolean);
  return 'Entendi: '+r.summary+'.'+(missing.length?' Falta confirmar: '+missing.join(', ')+'.':'')+(r.notes.length?' '+r.notes.join(' '):'');
}
export function bindQuickEntry(){
  $('qeForm').onsubmit=e=>{
    e.preventDefault();
    const text=$('qeText').value.trim();
    if(!text){toast('Escreva o lançamento. Ex.: gastei 85,90 no mercado hoje');return;}
    const r=parseQuickEntry(text,today());
    openTxForm({type:r.type,prefill:{value:r.value,date:r.date,desc:r.desc,cat:r.cat,fonte:r.fonte,acc:r.acc},note:noteOf(r)});
    $('qeText').value='';
  };
}

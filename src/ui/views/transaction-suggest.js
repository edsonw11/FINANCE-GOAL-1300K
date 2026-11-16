/**
 * ui/views/transaction-suggest.js
 * Responsibility: while typing the description of a new record, offers the category (and payment
 * source) used for the same description before, as one tap. It only suggests: nothing changes until
 * the user taps it, and a category already chosen is never overwritten silently.
 */
import { $, esc } from '../../core/dom.js';
import { suggestFromHistory } from '../../domain/import-history.js';
import { icon } from '../../domain/categories.js';
import { ui } from '../ui-state.js';
import { updateFormHelp } from './transaction-form.js';
const FONTE_TEXT={caixa:'conta/Pix',cartao:'cartão',beneficio:'VR/VA'};
export function bindDescriptionSuggestions(){
  let current=null;
  const box=$('descSug');
  const draw=()=>{
    box.innerHTML='';current=null;
    if(ui.editId!==null||(ui.type!=='despesa'&&ui.type!=='receita'))return;
    const sug=suggestFromHistory($('fDesc').value,ui.type);
    if(!sug)return;
    const sameFonte=ui.type==='receita'||$('fFonte').value===sug.fonte;
    if($('fCat').value.trim()===sug.cat&&sameFonte)return;
    current=sug;
    box.innerHTML=`<button type="button" class="chip sug" data-sug title="Usado antes com esta descrição">💡 ${icon(ui.type,sug.cat)} ${esc(sug.cat)}${ui.type==='despesa'&&sug.fonte?' · '+FONTE_TEXT[sug.fonte]:''}</button>`;
  };
  $('fDesc').addEventListener('input',draw);
  box.addEventListener('click',e=>{
    if(!e.target.closest('[data-sug]')||!current)return;
    $('fCat').value=current.cat;
    if(ui.type==='despesa'&&[...$('fFonte').options].some(o=>o.value===current.fonte))$('fFonte').value=current.fonte;
    $('fCat').dispatchEvent(new Event('input',{bubbles:true}));
    updateFormHelp();draw();
  });
}

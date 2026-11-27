/**
 * ui/views/transaction-split.js
 * Responsibility: Form: split a transaction across categories.
 */
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { $, esc } from '../../core/dom.js';
import { f2, m2, parse, sum } from '../../core/format.js';
import { ui } from '../ui-state.js';
import { chipsBox, revealChosenChips } from '../components/category-chips.js';
// ---- split a transaction across categories ----
export function resetSplit(){ui.splitRows=[];$('splitBox').hidden=true;$('splitHint').textContent='';}
export function updateSplitSum(){
  const tot=parse($('fVal').value),rest=tot-sum(ui.splitRows.map(r=>r.val||0));
  $('splitSum').innerHTML=tot>0?t('tx.split.rest',{cat:esc($('fCat').value.trim()||displayName(ui.type==='receita'?'Outros':'Imprevistos / Outros')),cls:rest<0?'neg':'',amount:f2(rest)}):'';
}
export function drawSplit(){
  const kind=ui.type==='receita'?'receita':'despesa';
  $('splitRows').innerHTML=ui.splitRows.map((r,i)=>`<div class="sp-part"><input data-sc="${i}" list="catList" placeholder="${t('tx.split.catPh')}" value="${esc(r.cat)}">${chipsBox(kind,r.cat)}<div class="row mb-6"><div class="f"><input data-sv="${i}" inputmode="decimal" placeholder="${t('tx.split.valuePh')}" value="${r.val?m2(r.val):''}"></div><button type="button" class="btn sm dng" data-sx="${i}">${t('tx.split.remove')}</button></div></div>`).join('');
  document.querySelectorAll('[data-sc]').forEach(el=>el.oninput=()=>{ui.splitRows[+el.dataset.sc].cat=el.value;});
  document.querySelectorAll('[data-sv]').forEach(el=>{el.oninput=()=>{ui.splitRows[+el.dataset.sv].val=parse(el.value);updateSplitSum();};el.onblur=()=>{const v=parse(el.value);if(v)el.value=m2(v);};});
  document.querySelectorAll('[data-sx]').forEach(el=>el.onclick=()=>{ui.splitRows.splice(+el.dataset.sx,1);if(!ui.splitRows.length)$('splitBox').hidden=true;drawSplit();});
  revealChosenChips($('splitRows'));
  updateSplitSum();
}
export function openSplit(){$('splitBox').hidden=false;if(!ui.splitRows.length)ui.splitRows.push({cat:'',val:0});drawSplit();}

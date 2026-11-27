/**
 * ui/views/transaction-split.js
 * Responsibility: Form: split a transaction across categories.
 */
import { $, esc } from '../../core/dom.js';
import { f2, m2, parse, sum } from '../../core/format.js';
import { ui } from '../ui-state.js';
import { chipsBox } from '../components/category-chips.js';
// ---- split a transaction across categories ----
export function resetSplit(){ui.splitRows=[];$('splitBox').hidden=true;$('splitHint').textContent='';}
export function updateSplitSum(){
  const tot=parse($('fVal').value),rest=tot-sum(ui.splitRows.map(r=>r.val||0));
  $('splitSum').innerHTML=tot>0?`Resto em <b>${esc($('fCat').value.trim()||(ui.type==='receita'?'Outros':'Imprevistos / Outros'))}</b>: <b class="${rest<0?'neg':''}">${f2(rest)}</b>`:'';
}
export function drawSplit(){
  const kind=ui.type==='receita'?'receita':'despesa';
  $('splitRows').innerHTML=ui.splitRows.map((r,i)=>`<div class="sp-part"><input data-sc="${i}" list="catList" placeholder="Categoria da parte (ex.: Saúde)" value="${esc(r.cat)}">${chipsBox(kind,r.cat)}<div class="row mb-6"><div class="f"><input data-sv="${i}" inputmode="decimal" placeholder="Valor (ex.: 99,90)" value="${r.val?m2(r.val):''}"></div><button type="button" class="btn sm dng" data-sx="${i}">remover</button></div></div>`).join('');
  document.querySelectorAll('[data-sc]').forEach(el=>el.oninput=()=>{ui.splitRows[+el.dataset.sc].cat=el.value;});
  document.querySelectorAll('[data-sv]').forEach(el=>{el.oninput=()=>{ui.splitRows[+el.dataset.sv].val=parse(el.value);updateSplitSum();};el.onblur=()=>{const v=parse(el.value);if(v)el.value=m2(v);};});
  document.querySelectorAll('[data-sx]').forEach(el=>el.onclick=()=>{ui.splitRows.splice(+el.dataset.sx,1);if(!ui.splitRows.length)$('splitBox').hidden=true;drawSplit();});
  updateSplitSum();
}
export function openSplit(){$('splitBox').hidden=false;if(!ui.splitRows.length)ui.splitRows.push({cat:'',val:0});drawSplit();}

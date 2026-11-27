/**
 * ui/components/category-chips.js
 * Responsibility: one-tap category buttons (chips) next to a category field: html for them, and ONE click handler for all of them.
 * A phone's own list for a field with a list is small and shows only what matches what is typed, so every such field also gets
 * its chips: tapping one fills the field (input and change events fire, so each screen reacts as if it had been typed).
 * The chips box must sit in the same wrapper as the field and carry data-qchips.
 */
import { esc } from '../../core/dom.js';
import { icon } from '../../domain/categories.js';
import { topCategories } from '../../domain/category-suggestions.js';
// the buttons only, the one equal to `current` marked
export function chipsHtml(type,current){
  const cur=String(current||'').trim();
  return topCategories(type).map(c=>`<button type="button" class="chip${c===cur?' on':''}" data-qc="${esc(c)}" aria-pressed="${c===cur}">${icon(type,c)} ${esc(c)}</button>`).join('');
}
// the box with its buttons, to put right after a category field
export const chipsBox=(type,current)=>`<div class="chips qchips" data-qchips="${type}">${chipsHtml(type,current)}</div>`;
// once, at start
export function installCategoryChips(){
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-qc]'),box=b&&b.closest('[data-qchips]'),input=box&&box.parentElement.querySelector('input[list]');
    if(!input)return;
    input.value=b.dataset.qc;
    ['input','change'].forEach(n=>input.dispatchEvent(new Event(n,{bubbles:true})));
    box.querySelectorAll('[data-qc]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});
  });
}

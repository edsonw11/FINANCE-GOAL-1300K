/**
 * ui/components/more-menu.js
 * Responsibility: the "⋯" menu for rare or risky actions (like delete), so they are not one tap away from the common
 * button. moreMenu(items, label) builds the markup; bindMoreMenus(root) closes a menu when another one opens or the
 * user taps elsewhere. items: [{label, attrs (extra attributes, e.g. a data-* action), danger}]
 */
import { t } from '../../core/i18n.js';
export function moreMenu(items,label){
  return `<details class="more"><summary class="btn sm more-btn" aria-label="${label||t('sys.menu.moreActions')}">⋯</summary><div class="more-pop">${items.map(i=>`<button type="button" class="more-item${i.danger?' dng':''}" ${i.attrs||''}>${i.label}</button>`).join('')}</div></details>`;
}
export function bindMoreMenus(root){
  const menus=[...root.querySelectorAll('details.more')];
  menus.forEach(d=>d.addEventListener('toggle',()=>{if(d.open)menus.forEach(o=>{if(o!==d)o.open=false;});}));
  if(!bindMoreMenus.bound){bindMoreMenus.bound=true;
    document.addEventListener('click',e=>{if(!e.target.closest('details.more'))document.querySelectorAll('details.more[open]').forEach(d=>{d.open=false;});});}
}

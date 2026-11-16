/**
 * ui/toast.js
 * Responsibility: temporary message at the bottom of the page. It is a popover, so it shows
 * above open dialogs (detail sheet, confirmation) too.
 */
import { $ } from '../core/dom.js';
export function toast(msg){
  const t=$('toast');t.textContent=msg;
  if(t.showPopover){try{if(t.matches(':popover-open'))t.hidePopover();t.showPopover();}catch(e){}}
  requestAnimationFrame(()=>t.classList.add('on'));
  clearTimeout(toast.h);clearTimeout(toast.h2);
  toast.h=setTimeout(()=>{t.classList.remove('on');toast.h2=setTimeout(()=>{try{t.hidePopover&&t.hidePopover();}catch(e){}},300);},msg.startsWith('⚠️')?5200:3200);
}

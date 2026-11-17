/**
 * ui/toast.js
 * Responsibility: temporary message at the bottom of the page. It is a popover, so it shows
 * above open dialogs (detail sheet, confirmation) too. An optional action (e.g. "Desfazer")
 * adds a button and keeps the message longer; the action runs once.
 */
import { $ } from '../core/dom.js';
const SHORT_MS=3200,WARN_MS=5200,ACTION_MS=8000;
// o = {action:{label, run}}
export function toast(msg,o){
  const t=$('toast'),act=o&&o.action;
  t.textContent=msg;
  if(act){const b=document.createElement('button');b.type='button';b.className='toast-act';b.textContent=act.label;
    b.onclick=()=>{b.disabled=true;hide();act.run();};t.appendChild(b);}
  t.classList.toggle('has-act',!!act);
  if(t.showPopover){try{if(t.matches(':popover-open'))t.hidePopover();t.showPopover();}catch(e){}}
  requestAnimationFrame(()=>t.classList.add('on'));
  clearTimeout(toast.h);clearTimeout(toast.h2);
  toast.h=setTimeout(hide,act?ACTION_MS:msg.startsWith('⚠️')?WARN_MS:SHORT_MS);
}
function hide(){
  const t=$('toast');clearTimeout(toast.h);t.classList.remove('on');
  clearTimeout(toast.h2);toast.h2=setTimeout(()=>{try{t.hidePopover&&t.hidePopover();}catch(e){}},300);
}

/**
 * ui/components/confirm.js
 * Responsibility: confirmation dialog that replaces the browser confirm(). Clear title and text,
 * "Cancelar" plus the action button, and an optional checkbox (for example "also the future ones").
 * askConfirm({title,text,ok,danger,check}) -> Promise of false (cancelled) or {checked}.
 */
import { $, esc } from '../../core/dom.js';
export function askConfirm(o){
  const d=$('confirmDlg');
  $('cfTitle').textContent=o.title||'Confirmar';
  $('cfText').innerHTML=o.html||esc(o.text||'').replace(/\n/g,'<br>');
  const ok=$('cfOk');ok.textContent=o.ok||'Confirmar';ok.className='btn '+(o.danger?'dngf':'pri');
  $('cfCheckW').hidden=!o.check;$('cfCheckL').textContent=o.check||'';$('cfCheck').checked=!!o.checkDefault;
  if(d.open)d.close();
  return new Promise(res=>{
    let done=false;
    const end=v=>{if(done)return;done=true;ok.onclick=$('cfCancel').onclick=null;d.removeEventListener('close',onClose);if(d.open)d.close();res(v);};
    const onClose=()=>{if(!d.open)end(false);}; // Esc or back gesture; a late close event of a previous dialog is ignored
    ok.onclick=()=>end({checked:$('cfCheck').checked});
    $('cfCancel').onclick=()=>end(false);
    d.addEventListener('close',onClose);
    d.showModal();$('cfCancel').focus();
  });
}

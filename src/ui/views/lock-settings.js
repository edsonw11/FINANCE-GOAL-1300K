/**
 * ui/views/lock-settings.js
 * Responsibility: the "Bloqueio do app" card in Ajustes: shown only inside the Android shell, one button that switches the lock on or off, and its explanation.
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
import { toast } from '../toast.js';
export function renderLockCard(lock,present){
  $('lockTitle').hidden=!present;$('lockCard').hidden=!present;
  if(!present)return;
  const on=lock.isEnabled();
  $('lockToggle').textContent=t(on?'set.lock.disable':'set.lock.enable');
  $('lockHelp').textContent=on
    ?t('set.lock.helpOn')
    :t('set.lock.helpOff');
}
export function bindLockSettings(lock,present){
  renderLockCard(lock,present);
  if(!present)return;
  $('lockToggle').onclick=async()=>{
    const b=$('lockToggle');b.disabled=true;
    try{
      const r=lock.isEnabled()?await lock.disable():await lock.enable();
      if(!r.ok&&r.message)toast(t('set.lock.failed',{message:r.message}));
      else if(r.ok)toast(t(lock.isEnabled()?'set.lock.on':'set.lock.off'));
    }finally{b.disabled=false;renderLockCard(lock,present);}
  };
}

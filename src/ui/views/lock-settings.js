/**
 * ui/views/lock-settings.js
 * Responsibility: the "Bloqueio do app" card in Ajustes: shown only inside the Android shell, one button that switches the lock on or off, and its explanation.
 */
import { $ } from '../../core/dom.js';
import { toast } from '../toast.js';
export function renderLockCard(lock,present){
  $('lockTitle').hidden=!present;$('lockCard').hidden=!present;
  if(!present)return;
  const on=lock.isEnabled();
  $('lockToggle').textContent=on?'🔓 Desativar o bloqueio':'🔒 Ativar o bloqueio';
  $('lockHelp').textContent=on
    ?'O app pede sua digital, seu rosto ou o PIN do celular ao abrir e depois de 30 segundos fora dele. A tela do app também some da lista de apps recentes.'
    :'Peça sua digital, seu rosto ou o PIN do celular para abrir o app. Funciona sem internet e não cria uma senha nova.';
}
export function bindLockSettings(lock,present){
  renderLockCard(lock,present);
  if(!present)return;
  $('lockToggle').onclick=async()=>{
    const b=$('lockToggle');b.disabled=true;
    try{
      const r=lock.isEnabled()?await lock.disable():await lock.enable();
      if(!r.ok&&r.message)toast('⚠️ '+r.message);
      else if(r.ok)toast(lock.isEnabled()?'Bloqueio do app ativado':'Bloqueio do app desativado');
    }finally{b.disabled=false;renderLockCard(lock,present);}
  };
}

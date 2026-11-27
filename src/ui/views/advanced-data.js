/**
 * ui/views/advanced-data.js
 * Responsibility: Settings → Data → Advanced: the actions that can lose data. Restore the automatic copy of the day
 * before, and erase everything (also the import log of this session). Both ask for confirmation and say exactly what will happen.
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
import { S, blankState, autoBackup, replaceState } from '../../domain/store.js';
import { restoreAutoBackup } from '../../domain/settings-commands.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { clearTrace } from './import-session.js';
export function renderAdvanced(){
  const b=autoBackup(),btn=$('restoreAuto');if(!btn)return;
  btn.hidden=!b;$('restoreAutoNote').textContent=b?t('set.advanced.autoCopyNote',{date:b.day.split('-').reverse().join('/')}):'';
}
export function bindAdvanced(){
  $('restoreAuto').onclick=async()=>{
    const b=autoBackup();if(!b)return;
    if(!await askConfirm({title:t('set.advanced.restoreTitle'),html:t('set.advanced.restoreHtml',{date:b.day.split('-').reverse().join('/')}),ok:t('set.advanced.restoreOk'),danger:true}))return;
    runCommand(restoreAutoBackup,{ok:t('set.advanced.restored')});
  };
  $('reset').onclick=async()=>{
    if(!await askConfirm({title:t('set.advanced.eraseAll'),html:t('set.advanced.eraseHtml'),ok:t('set.advanced.eraseAll'),danger:true}))return;
    if(runCommand(()=>{replaceState(blankState(S));return {erased:true};},{ok:t('set.advanced.erased')}))clearTrace();
  };
}

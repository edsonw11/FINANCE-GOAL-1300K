/**
 * ui/views/backup.js
 * Responsibility: Settings → Data: backup reminder, export, import (old backups are converted
 * by the domain). Dangerous actions live in advanced-data.js.
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
import { S, replaceState } from '../../domain/store.js';
import { importBackup } from '../../domain/settings-commands.js';
import { toast } from '../toast.js';
import { runCommand } from '../components/command.js';
import { renderDemo } from './settings-demo.js';
import { renderAdvanced } from './advanced-data.js';
import { backupReminder } from '../../domain/backup-reminder.js';
import { isNative, shareTextFile } from '../native-bridge.js';
const LAST_BACKUP_KEY='metaapp.lastBackup';
export function renderBackup(){renderDemo();renderAdvanced();
  const r=backupReminder(+localStorage.getItem(LAST_BACKUP_KEY)||0,Date.now());
  $('bkNote').innerHTML=r.show?`<div class="banner"><span>${r.days!==null?t('set.backup.reminderDays',{days:r.days}):t('set.backup.reminderNone')}</span><button class="btn sm pri" id="bkNow">${t('set.backup.now')}</button></div>`:'';
  const b=$('bkNow');if(b)b.onclick=()=>$('exp').click();
}
async function downloadJSON(data,name){
  const text=JSON.stringify(data,null,2);
  if(isNative()){const r=await shareTextFile(text,name);if(!r.ok&&!r.cancelled)toast(t('set.backup.saveFailed',{error:r.error}));return r.ok;}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click();return true;}
export function bindBackup(){
// the reminder only counts as done when the file really left (on the phone the person may close the share sheet)
$('exp').onclick=async()=>{if(await downloadJSON(S,'meta1300k-backup.json')){localStorage.setItem(LAST_BACKUP_KEY,String(Date.now()));renderBackup();}};
$('imp').onclick=()=>$('file').click();
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{let d;try{d=JSON.parse(rd.result);}catch(x){return toast(t('set.backup.invalidFile'));}
    const r=importBackup(d);if(r.error)return toast(t('set.backup.importError',{error:r.error}));
    runCommand(()=>replaceState(r.state),{ok:r.converted?t('set.backup.converted'):t('set.backup.imported')});};
  rd.readAsText(f);e.target.value='';};
}

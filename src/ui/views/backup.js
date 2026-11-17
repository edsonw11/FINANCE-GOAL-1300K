/**
 * ui/views/backup.js
 * Responsibility: Settings → Data: backup reminder, export, import (old backups are converted
 * by the domain). Dangerous actions live in advanced-data.js.
 */
import { $ } from '../../core/dom.js';
import { S, replaceState } from '../../domain/store.js';
import { importBackup } from '../../domain/settings-commands.js';
import { toast } from '../toast.js';
import { runCommand } from '../components/command.js';
import { renderDemo } from './settings-demo.js';
import { renderAdvanced } from './advanced-data.js';
import { backupReminder } from '../../domain/backup-reminder.js';
const LAST_BACKUP_KEY='metaapp.lastBackup';
export function renderBackup(){renderDemo();renderAdvanced();
  const r=backupReminder(+localStorage.getItem(LAST_BACKUP_KEY)||0,Date.now());
  $('bkNote').innerHTML=r.show?`<div class="banner"><span>${r.days!==null?'Seu último backup foi há '+r.days+' dias.':'Você ainda não fez backup.'} Os dados ficam só neste navegador.</span><button class="btn sm pri" id="bkNow">Fazer backup agora</button></div>`:'';
  const b=$('bkNow');if(b)b.onclick=()=>$('exp').click();
}
function downloadJSON(data,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();}
export function bindBackup(){
$('exp').onclick=()=>{localStorage.setItem(LAST_BACKUP_KEY,String(Date.now()));renderBackup();downloadJSON(S,'meta1300k-backup.json');};
$('imp').onclick=()=>$('file').click();
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{let d;try{d=JSON.parse(rd.result);}catch(x){return toast('⚠️ Arquivo inválido');}
    const r=importBackup(d);if(r.error)return toast('⚠️ '+r.error);
    runCommand(()=>replaceState(r.state),{ok:r.converted?'Backup antigo convertido. Confira os saldos na aba Patrimônio.':'✅ Backup importado'});};
  rd.readAsText(f);e.target.value='';};
}

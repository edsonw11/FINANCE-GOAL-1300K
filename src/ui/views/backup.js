/**
 * ui/views/backup.js
 * Responsibility: Settings → Data: backup reminder, export, import (old backups are converted
 * by the domain) and "erase everything".
 */
import { $ } from '../../core/dom.js';
import { S, replaceState, seed } from '../../domain/store.js';
import { importBackup } from '../../domain/settings-commands.js';
import { toast } from '../toast.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { renderDemo } from './settings-demo.js';
const LAST_BACKUP_KEY='metaapp.lastBackup';
export function renderBackup(){renderDemo();
  const t=+localStorage.getItem(LAST_BACKUP_KEY)||0,days=(Date.now()-t)/864e5;
  $('bkNote').innerHTML=days>14?`<div class="banner"><span>${t?'Seu último backup foi há '+Math.floor(days)+' dias.':'Você ainda não fez backup.'} Os dados ficam só neste navegador.</span><button class="btn sm pri" id="bkNow">Fazer backup agora</button></div>`:'';
  const b=$('bkNow');if(b)b.onclick=()=>$('exp').click();
}
function downloadJSON(data,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();}
export function bindBackup(){
$('exp').onclick=()=>{localStorage.setItem(LAST_BACKUP_KEY,String(Date.now()));renderBackup();downloadJSON(S,'meta1300k-backup.json');};
$('imp').onclick=()=>$('file').click();
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{let d;try{d=JSON.parse(rd.result);}catch(x){return toast('⚠️ Arquivo inválido');}
    const r=importBackup(d);if(r.error)return toast('⚠️ '+r.error);
    runCommand(()=>replaceState(r.state),{ok:r.converted?'Backup antigo convertido. Confira os saldos em Investimentos.':'✅ Backup importado'});};
  rd.readAsText(f);e.target.value='';};
$('reset').onclick=async()=>{if(await askConfirm({title:'Apagar tudo',html:'Apagar <b>todos</b> os lançamentos, saldos e ajustes e voltar ao estado inicial?<div class="bd-note mt-10">Não dá para desfazer. Exporte um backup antes, se quiser guardar.</div>',ok:'Apagar tudo',danger:true}))
  runCommand(()=>replaceState(seed()),{ok:'Dados apagados'});};
}

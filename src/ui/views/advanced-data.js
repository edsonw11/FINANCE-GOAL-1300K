/**
 * ui/views/advanced-data.js
 * Responsibility: Settings → Data → Advanced: the actions that can lose data. Restore the automatic copy of the day
 * before, and erase everything (also the import log of this session). Both ask for confirmation and say exactly what will happen.
 */
import { $ } from '../../core/dom.js';
import { S, blankState, autoBackup, replaceState } from '../../domain/store.js';
import { restoreAutoBackup } from '../../domain/settings-commands.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { clearTrace } from './import-session.js';
export function renderAdvanced(){
  const b=autoBackup(),btn=$('restoreAuto');if(!btn)return;
  btn.hidden=!b;$('restoreAutoNote').textContent=b?'Cópia de '+b.day.split('-').reverse().join('/')+' (o estado de antes das mudanças desse dia).':'';
}
export function bindAdvanced(){
  $('restoreAuto').onclick=async()=>{
    const b=autoBackup();if(!b)return;
    if(!await askConfirm({title:'Restaurar cópia automática?',html:`Seus dados voltam ao que eram em <b>${b.day.split('-').reverse().join('/')}</b>. O que você lançou depois disso será perdido.<div class="bd-note mt-10">Se quiser, exporte um backup antes.</div>`,ok:'Restaurar',danger:true}))return;
    runCommand(restoreAutoBackup,{ok:'Cópia restaurada'});
  };
  $('reset').onclick=async()=>{
    if(!await askConfirm({title:'Apagar tudo',html:'Apagar <b>todos</b> os lançamentos, contas de investimento, carteira, saldos e importações? Fica só a meta e a taxa.<div class="bd-note mt-10">Não dá para desfazer. Exporte um backup antes, se quiser guardar.</div>',ok:'Apagar tudo',danger:true}))return;
    if(runCommand(()=>{replaceState(blankState(S));return {erased:true};},{ok:'Tudo apagado: lançamentos, investimentos, carteira e saldos'}))clearTrace();
  };
}

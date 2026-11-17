/**
 * ui/views/own-names-view.js
 * Responsibility: the "Transferências entre suas contas" card in Settings: the user's names as banks
 * print them (add / remove) and how many transfers were kept. Changes go through domain commands.
 */
import { $, esc } from '../../core/dom.js';
import { addOwnName, ownNames, removeOwnName } from '../../domain/own-names.js';
import { transfers } from '../../domain/transfers.js';
import { runCommand } from '../components/command.js';
import { fieldError } from '../components/field-error.js';
export function renderOwnNames(){
  const el=$('ownNames');if(!el)return;
  const names=ownNames(),n=transfers().length;
  el.innerHTML=(names.length?`<div class="chips own-chips">${names.map(x=>`<span class="chip own-chip">${esc(x)}<button type="button" class="chip-x" data-own-del="${esc(x)}" aria-label="Remover ${esc(x)}">×</button></span>`).join('')}</div>`
    :'<div class="help m0">Nenhum nome ainda: Pix e TED para você mesmo vêm como despesa e você precisa trocar na mão.</div>')+
    (n?`<div class="help">🔁 ${n} transferência(s) entre suas contas guardada(s) pela importação (não contam como receita nem despesa).</div>`:'');
}
export function bindOwnNames(){
  const add=()=>{const i=$('ownNameIn');
    if(runCommand(()=>addOwnName(i.value),{ok:'✅ Nome salvo: Pix/TED com ele viram transferência na importação',onError:msg=>{if(msg)fieldError(i,msg);}}))i.value='';};
  $('ownNameAdd').onclick=add;
  $('ownNameIn').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};
  $('ownNames').onclick=e=>{const b=e.target.closest('[data-own-del]');if(b)runCommand(()=>removeOwnName(b.dataset.ownDel),{ok:'Nome removido'});};
}

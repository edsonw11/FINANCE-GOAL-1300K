/**
 * ui/views/own-names-view.js
 * Responsibility: the "Transferências entre suas contas" card in Settings: the user's names as banks
 * print them (add / remove), how many transfers were kept, and the records saved before the name was
 * known that are really transfers ("Corrigir"). Changes go through domain commands.
 */
import { $, esc } from '../../core/dom.js';
import { addOwnName, ownNames, removeOwnName } from '../../domain/own-names.js';
import { transfers } from '../../domain/transfers.js';
import { convertSavedTransfers, savedOwnTransfers } from '../../domain/saved-transfers.js';
import { f2 } from '../../core/format.js';
import { formatDateBR } from '../../core/dates.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { fieldError } from '../components/field-error.js';
export function renderOwnNames(){
  const el=$('ownNames');if(!el)return;
  const names=ownNames(),n=transfers().length;
  el.innerHTML=(names.length?`<div class="chips own-chips">${names.map(x=>`<span class="chip own-chip">${esc(x)}<button type="button" class="chip-x" data-own-del="${esc(x)}" aria-label="Remover ${esc(x)}">×</button></span>`).join('')}</div>`
    :'<div class="help m0">Nenhum nome ainda: Pix e TED para você mesmo vêm como despesa e você precisa trocar na mão.</div>')+
    (n?`<div class="help">🔁 ${n} transferência(s) entre suas contas guardada(s) pela importação (não contam como receita nem despesa).</div>`:'')+
    fixHtml(savedOwnTransfers());
}
// records imported before the name was saved: one line and one button to move them out of the totals
function fixHtml(list){
  if(!list.length)return '';
  const out=list.filter(t=>t.type==='despesa'),inn=list.filter(t=>t.type==='receita'),sum=a=>f2(a.reduce((x,t)=>x+t.value,0));
  return `<div class="own-fix"><div>⚠️ <b>${list.length}</b> lançamento(s) importado(s) antes parecem transferências suas: ${out.length?out.length+' despesa(s) de '+sum(out):''}${out.length&&inn.length?' e ':''}${inn.length?inn.length+' receita(s) de '+sum(inn):''}. Hoje eles contam nos totais do mês.</div>
    <button type="button" class="btn sm pri" id="ownFix">Corrigir</button></div>`;
}
function askFix(){
  const list=savedOwnTransfers();if(!list.length)return;
  const lines=list.slice(0,8).map(t=>`<li>${formatDateBR(t.date)} · ${esc(t.desc)} · ${f2(t.value)}</li>`).join('')+(list.length>8?`<li>e mais ${list.length-8}…</li>`:'');
  askConfirm({title:'Corrigir transferências',html:`Estes lançamentos viram <b>transferências entre suas contas</b> e deixam de contar como despesa ou receita:<ul class="own-fix-list">${lines}</ul>`,ok:'Corrigir '+list.length})
    .then(r=>{if(r)runCommand(()=>convertSavedTransfers(),{ok:x=>`🔁 ${x.count} lançamento(s) viraram transferência (${f2(x.total)})`});});
}
export function bindOwnNames(){
  const add=()=>{const i=$('ownNameIn');
    if(runCommand(()=>addOwnName(i.value),{ok:'✅ Nome salvo: Pix/TED com ele viram transferência na importação',onError:msg=>{if(msg)fieldError(i,msg);}}))i.value='';};
  $('ownNameAdd').onclick=add;
  $('ownNameIn').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};
  $('ownNames').onclick=e=>{if(e.target.closest('#ownFix'))return askFix();
    const b=e.target.closest('[data-own-del]');if(b)runCommand(()=>removeOwnName(b.dataset.ownDel),{ok:'Nome removido'});};
}

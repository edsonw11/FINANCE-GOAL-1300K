/**
 * ui/views/own-names-view.js
 * Responsibility: the "Transferências entre suas contas" card in Settings: the user's names as banks
 * print them (add / remove), how many transfers were kept, and the records saved before the name was
 * known that are really transfers ("Corrigir"). Changes go through domain commands.
 */
import { t } from '../../core/i18n.js';
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
  el.innerHTML=(names.length?`<div class="chips own-chips">${names.map(x=>`<span class="chip own-chip">${esc(x)}<button type="button" class="chip-x" data-own-del="${esc(x)}" aria-label="${t('set.own.remove',{name:esc(x)})}">×</button></span>`).join('')}</div>`
    :'<div class="help m0">'+t('set.own.empty')+'</div>')+
    (n?`<div class="help">${t('set.own.kept',{n})}</div>`:'')+
    fixHtml(savedOwnTransfers());
}
// records imported before the name was saved: one line and one button to move them out of the totals
function fixHtml(list){
  if(!list.length)return '';
  const out=list.filter(x=>x.type==='despesa'),inn=list.filter(x=>x.type==='receita'),sum=a=>f2(a.reduce((s,x)=>s+x.value,0));
  const key=out.length&&inn.length?'set.own.fixBoth':inn.length?'set.own.fixIncome':'set.own.fixExpenses';
  const text=t(key,{count:list.length,outN:out.length,outSum:sum(out),inN:inn.length,inSum:sum(inn)});
  return `<div class="own-fix"><div>${text}</div>
    <button type="button" class="btn sm pri" id="ownFix">${t('set.own.fix')}</button></div>`;
}
function askFix(){
  const list=savedOwnTransfers();if(!list.length)return;
  const lines=list.slice(0,8).map(x=>`<li>${formatDateBR(x.date)} · ${esc(x.desc)} · ${f2(x.value)}</li>`).join('')+(list.length>8?`<li>${t('set.own.more',{n:list.length-8})}</li>`:'');
  askConfirm({title:t('set.own.fixTitle'),html:t('set.own.fixHtml',{lines:`<ul class="own-fix-list">${lines}</ul>`}),ok:t('set.own.fixCount',{count:list.length})})
    .then(r=>{if(r)runCommand(()=>convertSavedTransfers(),{ok:x=>t('set.own.fixed',{count:x.count,total:f2(x.total)})});});
}
export function bindOwnNames(){
  const add=()=>{const i=$('ownNameIn');
    if(runCommand(()=>addOwnName(i.value),{ok:t('set.own.saved'),onError:msg=>{if(msg)fieldError(i,msg);}}))i.value='';};
  $('ownNameAdd').onclick=add;
  $('ownNameIn').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};
  $('ownNames').onclick=e=>{if(e.target.closest('#ownFix'))return askFix();
    const b=e.target.closest('[data-own-del]');if(b)runCommand(()=>removeOwnName(b.dataset.ownDel),{ok:t('set.own.removed')});};
}

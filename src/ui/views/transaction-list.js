/**
 * ui/views/transaction-list.js
 * Responsibility: Transactions tab: list of the month's transactions, filtered by type and expense group;
 * a search lists every month (rules in domain/transaction-filter.js). Tap a row for the detail.
 */
import { tt } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { mLabel, mOf } from '../../core/dates.js';
import { catParts } from '../../domain/transactions.js';
import { ALL_TYPES, filterTransactions, listTotal, searchesAllMonths } from '../../domain/transaction-filter.js';
import { groupIcon, groupNames } from '../../domain/category-groups.js';
import { invoiceItems, invoiceUndetailed } from '../../domain/card-invoices.js';
import { ui } from '../ui-state.js';
import { paymentLabel, signedMoney, txRow } from '../components/breakdown.js';
import { fillCategoryOptions } from './transaction-form.js';
import { openTxForm } from './transaction-form-sheet.js';
export function renderTransactions(){
  document.querySelectorAll('.chip[data-f]').forEach(c=>{c.classList.toggle('on',c.dataset.f===ui.filt);c.setAttribute('aria-pressed',c.dataset.f===ui.filt);});
  renderGroupFilter();
  const f={type:ui.filt,group:ui.group,query:ui.q},rows=filterTransactions(ui.cur,f),filtered=!!(ui.q||ui.group||ui.filt!==ALL_TYPES),all=searchesAllMonths(f);
  // grouped by day (and by month when searching every month), newest first. Editar on wide screens, tap the
  // row everywhere; deleting is in the record's detail, with Desfazer
  let day='',month='',h='';
  rows.forEach(({t,value})=>{
    if(all&&mOf(t.date)!==month){month=mOf(t.date);h+=`<div class="li-month">${mLabel(month)}</div>`;}
    if(t.date!==day){day=t.date;h+=`<div class="li-day">${new Date(day+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})}</div>`;}
    // the category is the person's text: the line goes into HTML escaped
    const sub=esc([t.type==='fatura'?tt('tx.list.identified',{count:invoiceItems(t).length})+(invoiceUndetailed(t)>0?tt('tx.list.undetailedSuffix',{amount:f2(invoiceUndetailed(t))}):''):t.desc&&t.cat?(t.splits&&t.splits.length?catParts(t).map(p=>displayName(p.cat)).join(' + '):displayName(t.cat)):'',paymentLabel(t)].filter(Boolean).join(' · '));
    h+=txRow(t,{sub,value:ui.group?value:undefined,actions:`<span class="li-act"><button type="button" class="btn sm" data-edit="${t.id}" aria-label="${tt('tx.common.edit')}">${tt('tx.common.edit')}</button></span>`});
  });
  const tot=listTotal(rows),signed=ui.filt===ALL_TYPES&&!ui.group;
  $('txList').innerHTML=rows.length?`<div class="li-sum"><span>${tt('tx.list.count',{count:rows.length})}${ui.group?tt('tx.list.inGroup',{group:esc(displayName(ui.group))}):''}${all?tt('tx.list.allMonths'):''}</span><span>${signed?tt('tx.list.balance'):tt('tx.list.total')}<b>${signed?signedMoney(tot):f2(Math.abs(tot))}</b></span></div>`+h
    :`<div class="empty">${filtered?(all?tt('tx.list.nothingAny'):tt('tx.list.nothingFilter'))+' <button type="button" class="btn sm" id="clearFilt">'+tt('tx.list.clearFilter')+'</button>':tt('tx.list.emptyMonth',{month:mLabel(ui.cur)})}</div>`;
  const cf=$('clearFilt');if(cf)cf.onclick=()=>{ui.filt=ALL_TYPES;ui.q='';ui.group='';$('qBox').value='';renderTransactions();};
  fillCategoryOptions();
}
// expense group select: lists the groups that have categories; keeps the choice if it still exists
function renderGroupFilter(){
  const sel=$('grpSel'),names=groupNames();
  if(ui.group&&!names.includes(ui.group))ui.group='';
  sel.innerHTML=`<option value="">${tt('tx.list.allGroups')}</option>`+names.map(g=>`<option value="${esc(g)}">${groupIcon(g)} ${esc(displayName(g))}</option>`).join('');
  sel.value=ui.group;sel.classList.toggle('on',!!ui.group);
}
export function bindTransactionList(){
  $('grpSel').onchange=e=>{ui.group=e.target.value;renderTransactions();};
  $('txList').addEventListener('click',e=>{
    const ed=e.target.closest('[data-edit]');
    if(ed)openTxForm({id:+ed.dataset.edit});
  });
}

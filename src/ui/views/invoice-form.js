/**
 * ui/views/invoice-form.js
 * Responsibility: Advanced invoice payment form (checked purchases).
 */
import { UNDETAILED_CAT } from '../../domain/spending.js';
import { displayName } from '../../core/stored-names.js';
import { t } from '../../core/i18n.js';
import { $, esc } from '../../core/dom.js';
import { f2, parse, sum } from '../../core/format.js';
import { formatDateBR, mIdx, mKey, today } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { icon } from '../../domain/categories.js';
import { closeDateOf, cycleStart, dueDateOf, dueMonth, invoiceMonthOf, nearestDueMonth } from '../../domain/card-cycle.js';
import { openCard } from '../../domain/card-invoices.js';
import { ui } from '../ui-state.js';
import { openItem } from './item-dialog.js';
// "Fatura que vence em": list of due dates instead of a month field (works the same on every phone)
export function fillInvoiceMonths(){
  const sel=$('fFm'),base=mIdx(dueMonth(today())),keep=sel.value;
  const ms=[];for(let i=-12;i<=3;i++)ms.push(mKey(base+i));
  S.tx.forEach(t=>{if(t.type==='fatura'){const fm=invoiceMonthOf(t);if(!ms.includes(fm))ms.push(fm);}});
  ms.sort().reverse();
  _selectValue.set.call(sel,'');
  sel.innerHTML=ms.map(fm=>`<option value="${fm}">${formatDateBR(dueDateOf(fm))}${fm===dueMonth(today())?t('tx.invForm.currentSuffix'):''}</option>`).join('');
  if(keep)sel.value=keep;
}
const _selectValue=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
export function bindInvoiceMonthField(){
  const sel=$('fFm');
  // any month set by code is accepted: the option is created when missing
  Object.defineProperty(sel,'value',{configurable:true,get(){return _selectValue.get.call(sel);},
    set(v){if(v&&![...sel.options].some(o=>o.value===v)){sel.insertAdjacentHTML('beforeend',`<option value="${v}">${formatDateBR(dueDateOf(v))}</option>`);}_selectValue.set.call(sel,v);}});
  fillInvoiceMonths();
}
// marks the open purchases of the invoice that is chosen (or all of them when "any date" is on); never changes the chosen invoice
export function selectInvoicePurchases(){
  ui.invoiceSelection=new Set(openCard(null,ui.editId).filter(t=>$('fAll').checked||dueMonth(t.date)===$('fFm').value).map(t=>t.id));}
// a new payment starts on the invoice of its date; choosing another invoice (or ticking "any date") must keep that choice
export function initInvoiceForm(){if(ui.editId===null)$('fFm').value=nearestDueMonth($('fDate').value||today());
  selectInvoicePurchases();}
export function drawInvoiceForm(ex){
  ex=ex===undefined?ui.editId:ex;
  const fmSel=$('fFm').value||nearestDueMonth($('fDate').value||today());
  $('fmRange').textContent=t('tx.invForm.range',{from:formatDateBR(cycleStart(fmSel)),to:formatDateBR(closeDateOf(fmSel)),due:formatDateBR(dueDateOf(fmSel))});
  const lblInclude=t('tx.invForm.include'),lblEdit=t('tx.common.clickToEdit');
  const open=openCard(null,ex).filter(t=>$('fAll').checked||dueMonth(t.date)===fmSel).sort((a,b)=>a.date.localeCompare(b.date));
  ui.invoiceSelection=new Set([...ui.invoiceSelection].filter(id=>open.some(t=>t.id===id)));
  $('fatList').innerHTML=open.length?open.map(t=>`<div class="pay-line"><input type="checkbox" data-fi="${t.id}" ${ui.invoiceSelection.has(t.id)?'checked':''} class="w-auto" aria-label="${lblInclude}"><span class="fitem f1 tap-t" data-fe="${t.id}" title="${lblEdit}">${formatDateBR(t.date)} · ${icon('despesa',t.cat)} ${esc(displayName(t.cat))} <span class="mut">${esc(t.desc||'')}</span> <span class="mut fs12">✎</span></span><b>${f2(t.value)}</b></div>`).join(''):`<div class="help flush">${t('tx.invForm.noOpen',{undetailed:displayName(UNDETAILED_CAT)})}</div>`;
  document.querySelectorAll('[data-fi]').forEach(el=>el.onchange=()=>{el.checked?ui.invoiceSelection.add(+el.dataset.fi):ui.invoiceSelection.delete(+el.dataset.fi);updateInvoiceSummary();});
  document.querySelectorAll('[data-fe]').forEach(el=>el.onclick=()=>openItem(+el.dataset.fe));
  updateInvoiceSummary();
}
export function selectedInvoiceTotal(){return sum([...ui.invoiceSelection].map(id=>(S.tx.find(x=>x.id===id)||{value:0}).value));}
export function updateInvoiceSummary(){
  if(ui.type!=='fatura')return;
  const sel=selectedInvoiceTotal(),v=parse($('fVal').value),rest=v-sel;
  $('fatSum').innerHTML=t('tx.invForm.marked',{amount:f2(sel)})+(v>0?t('tx.invForm.totals',{total:f2(v),cls:rest<0?'neg':'',rest:f2(rest)})+(rest<-0.004?t('tx.invForm.over'):''):'');
}

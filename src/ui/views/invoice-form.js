/**
 * ui/views/invoice-form.js
 * Responsibility: Advanced invoice payment form (checked purchases).
 */
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
  sel.innerHTML=ms.map(fm=>`<option value="${fm}">${formatDateBR(dueDateOf(fm))}${fm===dueMonth(today())?' (atual)':''}</option>`).join('');
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
export function initInvoiceForm(){if(ui.editId===null)$('fFm').value=nearestDueMonth($('fDate').value||today());
  ui.invoiceSelection=new Set(openCard(null,ui.editId).filter(t=>$('fAll').checked||dueMonth(t.date)===$('fFm').value).map(t=>t.id));}
export function drawInvoiceForm(ex){
  ex=ex===undefined?ui.editId:ex;
  const fmSel=$('fFm').value||nearestDueMonth($('fDate').value||today());
  $('fmRange').textContent='Compras de '+formatDateBR(cycleStart(fmSel))+' a '+formatDateBR(closeDateOf(fmSel))+' · vence em '+formatDateBR(dueDateOf(fmSel));
  const open=openCard(null,ex).filter(t=>$('fAll').checked||dueMonth(t.date)===fmSel).sort((a,b)=>a.date.localeCompare(b.date));
  ui.invoiceSelection=new Set([...ui.invoiceSelection].filter(id=>open.some(t=>t.id===id)));
  $('fatList').innerHTML=open.length?open.map(t=>`<div class="pay-line"><input type="checkbox" data-fi="${t.id}" ${ui.invoiceSelection.has(t.id)?'checked':''} class="w-auto" aria-label="Incluir na fatura"><span class="fitem f1 tap-t" data-fe="${t.id}" title="Clique para editar">${formatDateBR(t.date)} · ${icon('despesa',t.cat)} ${esc(t.cat)} <span class="mut">${esc(t.desc||'')}</span> <span class="mut fs12">✎</span></span><b>${f2(t.value)}</b></div>`).join(''):'<div class="help flush">Nenhuma compra de cartão em aberto. A fatura inteira entrará como “Cartão (sem detalhe)”.</div>';
  document.querySelectorAll('[data-fi]').forEach(el=>el.onchange=()=>{el.checked?ui.invoiceSelection.add(+el.dataset.fi):ui.invoiceSelection.delete(+el.dataset.fi);updateInvoiceSummary();});
  document.querySelectorAll('[data-fe]').forEach(el=>el.onclick=()=>openItem(+el.dataset.fe));
  updateInvoiceSummary();
}
export function selectedInvoiceTotal(){return sum([...ui.invoiceSelection].map(id=>(S.tx.find(x=>x.id===id)||{value:0}).value));}
export function updateInvoiceSummary(){
  if(ui.type!=='fatura')return;
  const sel=selectedInvoiceTotal(),v=parse($('fVal').value),rest=v-sel;
  $('fatSum').innerHTML=`Marcadas: <b>${f2(sel)}</b>`+(v>0?` · Fatura: <b>${f2(v)}</b> · Sem detalhe: <b class="${rest<0?'neg':''}">${f2(rest)}</b>`+(rest<-0.004?` <span class="neg">· as marcadas passam da fatura: corrija os valores ou desmarque</span>`:''):'');
}

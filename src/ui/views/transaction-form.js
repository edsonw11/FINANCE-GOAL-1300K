/**
 * ui/views/transaction-form.js
 * Responsibility: Transactions tab: form (type, categories, editing and help text).
 */
import { tt } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { $, esc } from '../../core/dom.js';
import { m2 } from '../../core/format.js';
import { addDay, formatDateBR, today } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { active } from '../../domain/accounts.js';
import { futureSiblings } from '../../domain/transactions.js';
import { chipsHtml } from '../components/category-chips.js';
import { closeDateOf, dueDateOf, dueMonth, invoiceMonthOf } from '../../domain/card-cycle.js';
import { alloc } from '../../domain/card-invoices.js';
import { ui } from '../ui-state.js';
import { Sheet } from '../components/sheet.js';
import { drawSplit, resetSplit } from './transaction-split.js';
import { drawInvoiceForm } from './invoice-form.js';
import { NEW_TITLE, formInSheet } from './transaction-form-sheet.js';
import { isQuickPay, renderPay } from './pay-invoice.js';
export function startEdit(id){
  const t=S.tx.find(x=>x.id===id);if(!t)return;
  ui.editId=id;ui.type=t.type;document.querySelector(`input[name=tp][value=${t.type}]`).checked=true;fillCategoryOptions();
  $('fDate').value=t.date;$('fVal').value=m2(t.value);$('fDesc').value=t.desc||'';
  if(t.type==='aporte')$('fAcc').value=t.acc;else $('fCat').value=displayName(t.cat||'');
  $('fReinv').checked=!!t.reinv;
  $('fFonte').value=t.fonte||'caixa';
  if(t.type==='fatura'){$('fFm').value=invoiceMonthOf(t);ui.invoiceSelection=new Set(alloc().map[t.id]||[]);drawInvoiceForm(id);}
  ui.splitRows=(t.splits||[]).map(s=>({cat:displayName(s.cat),val:s.value}));$('splitBox').hidden=!(ui.splitRows.length);$('wMore').open=ui.splitRows.length>0;drawSplit();
  const sib=futureSiblings(t);$('wApply').hidden=!(sib.length);$('fApply').checked=true;$('applyN').textContent=sib.length;
  ui.editId=id;$('fCancel').hidden=false;$('fRep').disabled=true;fillCategoryOptions();
}
export function endEdit(){resetSplit();ui.invoiceSelection=new Set();$('wApply').hidden=true;ui.editId=null;$('fCancel').hidden=true;$('fRep').disabled=false;$('fRep').value='1';$('fReinv').checked=false;ui.payAdvanced=false;fillCategoryOptions();}
// getters: the text follows the active language every time it is read
const SAVE_LABEL={get despesa(){return tt('tx.form.saveExpense');},get receita(){return tt('tx.form.saveIncome');},get aporte(){return tt('tx.form.saveContribution');},get fatura(){return tt('tx.form.savePayment');}};
export function updateSaveLabel(){
  $('fSave').textContent=ui.editId!==null?tt('tx.form.saveChanges'):SAVE_LABEL[ui.type]||tt('tx.form.saveDefault');
  $('fCancel').textContent=ui.editId!==null||formInSheet?tt('tx.common.cancel'):tt('tx.form.cancelEdit');
  if(formInSheet&&ui.editId===null&&Sheet.top()&&Sheet.top().static)$('shTitle').textContent=NEW_TITLE[ui.type]||tt('tx.sheet.newTx');
}
// most used categories of the type (last 6 months) as one-tap chips
function drawCategoryChips(){
  const box=$('catChips');if(!box)return;
  if(ui.type!=='despesa'&&ui.type!=='receita'){box.innerHTML='';return;}
  box.dataset.qchips=ui.type;box.innerHTML=chipsHtml(ui.type,$('fCat').value);
}
export function fillCategoryOptions(){
  const set=new Set(((S.cats||{})[ui.type]||[]).filter(c=>!c.off).map(c=>c.name));
  $('catList').innerHTML=[...set].map(c=>`<option value="${esc(displayName(c))}">`).join('');
  $('wCat').hidden=ui.type==='aporte';$('wAcc').hidden=!(ui.type==='aporte');$('wReinv').hidden=!(ui.type==='aporte');
  const kf=$('fFonte').value;
  $('lFonte').textContent=ui.type==='receita'?tt('tx.field.enteredIn'):tt('tx.field.paidWith');
  $('fFonte').innerHTML=ui.type==='receita'
    ?`<option value="caixa">${tt('tx.form.srcAccountIn')}</option><option value="beneficio">${tt('tx.form.srcBenefit')}</option>`
    :`<option value="caixa">${tt('tx.form.srcAccountPix')}</option><option value="cartao">${tt('tx.form.srcCredit')}</option><option value="beneficio">${tt('tx.form.srcBenefit')}</option>`;
  if(kf&&[...$('fFonte').options].some(o=>o.value===kf))$('fFonte').value=kf;
  const noCat=ui.type==='aporte'||ui.type==='fatura';
  $('wCat').hidden=noCat;
  $('wFonte').hidden=noCat;$('wSplit').hidden=noCat;
  const quick=isQuickPay();
  $('fGrid').hidden=quick;$('fActions').hidden=quick;
  $('fatBox').hidden=!(ui.type==='fatura'&&!quick);$('payBox').hidden=!(quick);
  if(ui.type==='fatura'&&!quick)drawInvoiceForm();if(quick)renderPay();
  updateFormHelp();updateSaveLabel();drawCategoryChips();
  const keep=$('fAcc').value;
  $('fAcc').innerHTML=active().map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if(keep)$('fAcc').value=keep;
  updateFormHelp();
}
function cardHint(){const d=$('fDate').value||today(),fm=dueMonth(d);
  return tt('tx.form.cardHint',{due:formatDateBR(dueDateOf(fm)),close:formatDateBR(closeDateOf(fm)),next:formatDateBR(addDay(closeDateOf(fm),1))});}
export function updateFormHelp(){
  $('fHelp').textContent=ui.type==='aporte'?tt('tx.form.helpContribution')
    :ui.type==='fatura'?tt('tx.form.helpInvoice')
    :(ui.type==='despesa'&&$('fFonte').value==='cartao')?cardHint():'';
}

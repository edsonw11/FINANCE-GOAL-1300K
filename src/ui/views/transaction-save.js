/**
 * ui/views/transaction-save.js
 * Responsibility: the "save" button of the transaction form. Reads the fields, asks the domain
 * to validate (message next to the field) and to save (domain/transaction-builder.js), then
 * returns to where the user came from. If saving fails, the form keeps what was typed.
 */
import { BUDGET_LEVEL, budgetAlerts } from '../../domain/budgets.js';
import { groupOf } from '../../domain/category-groups.js';
import { $ } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { mOf, today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { accName, balance } from '../../domain/accounts.js';
import { saveTransaction, validateTransaction } from '../../domain/transaction-builder.js';
import { ui } from '../ui-state.js';
import { toast } from '../toast.js';
import { clearFieldErrors, fieldError } from '../components/field-error.js';
import { runCommand } from '../components/command.js';
import { render } from '../render.js';
import { endEdit } from './transaction-form.js';
import { selectedInvoiceTotal } from './invoice-form.js';
import { afterFormSave } from './transaction-form-sheet.js';
function readTransactionForm(){
  return {editId:ui.editId,type:ui.type,value:parseMoney($('fVal').value),date:$('fDate').value,cat:$('fCat').value,fonte:$('fFonte').value,
    desc:$('fDesc').value,acc:$('fAcc').value,splits:ui.splitRows.map(r=>({cat:r.cat,value:r.val})),
    fm:$('fFm').value,items:[...ui.invoiceSelection],invoiceSelectedTotal:selectedInvoiceTotal(),
    repeat:+$('fRep').value,applyToFuture:$('fApply').checked};
}
const FORM_FIELD={value:'fVal',date:'fDate',acc:'fAcc'};
function successMessage(d,r){
  if(d.editId!==null)return '✅ Lançamento atualizado'+(r.siblings?' e mais '+r.siblings+' futuro(s)':'');
  if(d.type==='aporte')return `🏦 Aporte de ${f2(d.value)} em ${accName(d.acc)}. Saldo agora: ${f2(balance(d.acc,today()).v)}`;
  if(d.type==='fatura')return '💳 Pagamento de fatura de '+f2(d.value)+' registrado';
  return (d.type==='receita'?'➕ Receita':'➖ Despesa')+' de '+f2(d.value)+' adicionada'+(r.ids.length>1?` (${r.ids.length}x)`:'');
}
// "⚠️ Moradia: 92% do orçamento" when the saved expense leaves its group near or over the budget
export function budgetWarning(d){
  if(d.type!=='despesa')return '';
  const cats=[d.cat].concat((d.splits||[]).map(s=>s.cat)).filter(Boolean);
  const a=budgetAlerts(mOf(d.date),cats,groupOf);
  return a.map(x=>` · ⚠️ ${x.group}: ${Math.round(x.share*100)}% do orçamento${x.level===BUDGET_LEVEL.over?' (estourou)':''}`).join('');
}
export function bindTransactionSave(){
$('fSave').onclick=()=>{
  const btn=$('fSave');if(btn.disabled)return;
  const d=readTransactionForm();
  clearFieldErrors($('txForm'));
  const err=validateTransaction(d);
  if(err)return fieldError($(FORM_FIELD[err.field]||'fVal'),err.msg);
  btn.disabled=true;btn.classList.add('busy');
  const r=runCommand(()=>saveTransaction(d),{render:false});
  btn.disabled=false;btn.classList.remove('busy');
  if(!r)return; // nothing changed: the form keeps what was typed
  // a new record shows its month; an edit keeps the period the user was looking at
  if(d.editId===null)ui.cur=mOf(d.date);
  $('fVal').value='';$('fDesc').value='';endEdit();
  afterFormSave();render();toast(successMessage(d,r)+budgetWarning(d));
};
}

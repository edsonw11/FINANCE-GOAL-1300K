/**
 * ui/views/item-dialog.js
 * Responsibility: Pop-up for a single card purchase (create, edit, delete) inside the invoice forms.
 */
import { chipsHtml } from '../components/category-chips.js';
import { $ } from '../../core/dom.js';
import { m2 } from '../../core/format.js';
import { today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { futureSiblings } from '../../domain/transactions.js';
import { saveTransaction, validateTransaction } from '../../domain/transaction-builder.js';
import { ui } from '../ui-state.js';
import { toast } from '../toast.js';
import { clearFieldErrors, fieldError } from '../components/field-error.js';
import { runCommand } from '../components/command.js';
import { render } from '../render.js';
import { drawInvoiceForm } from './invoice-form.js';
import { deleteTxFlow } from './transaction-actions.js';
// ---- pop-up for a card purchase ----
let dlgId=null;
export function openItem(id,defDate){
  dlgId=id;const t=id?S.tx.find(x=>x.id===id):null;
  $('itemTitle').textContent=t?'Editar compra no cartão':'Adicionar compra esquecida';
  $('dCat').value=t?t.cat:'';$('dCatChips').innerHTML=chipsHtml('despesa',t?t.cat:'');$('dDesc').value=t?(t.desc||''):'';$('dVal').value=t?m2(t.value):'';
  $('dDate').value=t?t.date:(defDate||$('fDate').value||today());$('dDel').hidden=!(t);
  const sib=t?futureSiblings(t):[];$('dApplyW').hidden=!(sib.length);$('dApply').checked=true;$('dApplyN').textContent=sib.length;
  clearFieldErrors($('itemForm'));$('itemDlg').showModal();if(!t)$('dCat').focus();
}
export function bindItemDialog(){
$('nfAdd').onclick=()=>openItem(null);
$('dCancel').onclick=()=>$('itemDlg').close();
$('itemForm').onsubmit=e=>{e.preventDefault();$('dSave').click();};
$('dSave').onclick=()=>{
  const t=dlgId?S.tx.find(x=>x.id===dlgId):null;
  const d={editId:dlgId||null,type:'despesa',fonte:'cartao',cat:$('dCat').value.trim(),desc:$('dDesc').value,value:parseMoney($('dVal').value),date:$('dDate').value,
    splits:t&&t.splits?t.splits:[],applyToFuture:$('dApply').checked};
  clearFieldErrors($('itemForm'));
  if(!d.cat)return fieldError($('dCat'),'Informe a categoria');
  const err=validateTransaction(d);if(err)return fieldError({value:$('dVal'),date:$('dDate')}[err.field]||$('dVal'),err.msg);
  const r=runCommand(()=>saveTransaction(d),{render:false});
  if(!r)return; // the form keeps what was typed
  if(!dlgId)ui.invoiceSelection.add(r.ids[0]);
  $('itemDlg').close();drawInvoiceForm();render();
  toast(dlgId?'✅ Compra atualizada'+(r.siblings?' e mais '+r.siblings+' futura(s)':''):'✅ Compra adicionada à fatura');
};
$('dDel').onclick=async()=>{const t=S.tx.find(x=>x.id===dlgId);if(!t)return;
  $('itemDlg').close();
  if(await deleteTxFlow(t.id)){ui.invoiceSelection.delete(t.id);drawInvoiceForm();}else $('itemDlg').showModal();};
}

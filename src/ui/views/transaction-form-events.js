/**
 * ui/views/transaction-form-events.js
 * Responsibility: Event handlers of the transaction form.
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
import { m2, parse } from '../../core/format.js';
import { today } from '../../core/dates.js';
import { ui } from '../ui-state.js';
import { renderTransactions } from './transaction-list.js';
import { endEdit, fillCategoryOptions, updateFormHelp } from './transaction-form.js';
import { drawSplit, openSplit, resetSplit, updateSplitSum } from './transaction-split.js';
import { drawInvoiceForm, initInvoiceForm, selectInvoicePurchases, selectedInvoiceTotal, updateInvoiceSummary } from './invoice-form.js';
export function bindTransactionFormEvents(){
document.querySelectorAll('input[name=tp]').forEach(r=>r.onchange=()=>{ui.type=r.value;ui.payAdvanced=false;if(ui.type==='fatura')initInvoiceForm();fillCategoryOptions();$('fCat').value='';});
$('fDate').value=today();
$('fDate').onchange=()=>{updateFormHelp();if(ui.type!=='fatura')return;initInvoiceForm();drawInvoiceForm();};
$('fFm').onchange=()=>{selectInvoicePurchases();drawInvoiceForm();};
$('fAll').onchange=()=>{selectInvoicePurchases();drawInvoiceForm();};
$('fCancel').onclick=()=>{endEdit();$('fVal').value='';$('fDesc').value='';};
$('chips').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;ui.filt=c.dataset.f;renderTransactions();};
$('qBox').oninput=e=>{ui.q=e.target.value.trim();renderTransactions();};
$('fRep').innerHTML=`<option value="1">${t('tx.form.noRepeat')}</option>`+Array.from({length:11},(_,i)=>`<option value="${i+2}">${t('tx.form.everyMonth',{n:i+2})}</option>`).join('');
$('fVal').onblur=()=>{const v=parse($('fVal').value);if(v)$('fVal').value=m2(v);updateSplitSum();};
$('fVal').oninput=()=>{updateSplitSum();updateInvoiceSummary();};
$('fatUse').onclick=()=>{const s=selectedInvoiceTotal();if(s>0){$('fVal').value=m2(s);updateInvoiceSummary();}};
$('fFonte').onchange=updateFormHelp;
$('splitBtn').onclick=()=>{$('splitBox').hidden?openSplit():resetSplit();};
$('splitAdd').onclick=()=>{ui.splitRows.push({cat:'',val:0});drawSplit();};
$('fCat').oninput=()=>{updateSplitSum();
  const card=ui.type==='despesa'&&/cart[aã]o/i.test($('fCat').value);
  $('splitHint').textContent=card&&$('splitBox').hidden?t('tx.form.splitHint'):'';};
}

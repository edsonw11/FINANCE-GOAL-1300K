/**
 * ui/views/lancamentos-events.js
 * Responsibility: Event handlers of the transaction form.
 */
function bindTransactionFormEvents(){
document.querySelectorAll('input[name=tp]').forEach(r=>r.onchange=()=>{type=r.value;payAdvanced=false;if(type==='fatura')initInvoiceForm();fillCategoryOptions();$('fCat').value='';});
$('fDate').value=today();
$('fDate').onchange=()=>{updateFormHelp();if(type!=='fatura')return;initInvoiceForm();drawInvoiceForm();};
$('fFm').onchange=()=>{initInvoiceForm();drawInvoiceForm();};
$('fAll').onchange=()=>{initInvoiceForm();drawInvoiceForm();};
$('fCancel').onclick=()=>{endEdit();$('fVal').value='';$('fDesc').value='';};
$('chips').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;filt=c.dataset.f;renderTransactions();};
$('qBox').oninput=e=>{q=e.target.value.trim();renderTransactions();};
$('fRep').innerHTML='<option value="1">Não repetir</option>'+Array.from({length:11},(_,i)=>`<option value="${i+2}">Todo mês · ${i+2}x</option>`).join('');
$('fVal').onblur=()=>{const v=parse($('fVal').value);if(v)$('fVal').value=m2(v);updateSplitSum();};
$('fVal').oninput=()=>{updateSplitSum();updateInvoiceSummary();};
$('fatUse').onclick=()=>{const s=selectedInvoiceTotal();if(s>0){$('fVal').value=m2(s);updateInvoiceSummary();}};
$('fFonte').onchange=updateFormHelp;
$('splitBtn').onclick=()=>{$('splitBox').style.display==='none'?openSplit():resetSplit();};
$('splitAdd').onclick=()=>{splitRows.push({cat:'',val:0});drawSplit();};
$('fCat').oninput=()=>{updateSplitSum();
  const card=type==='despesa'&&/cart[aã]o/i.test($('fCat').value);
  $('splitHint').textContent=card&&$('splitBox').style.display==='none'?'💡 A fatura tem itens de outras categorias (ex.: academia)? Use “Dividir”.':'';};
}

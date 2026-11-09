/**
 * ui/views/lancamentos-fatura.js
 * Responsibility: Advanced invoice payment form (checked purchases).
 */
function initInvoiceForm(){if(editId===null)$('fFm').value=nearestDueMonth($('fDate').value||today());
  invoiceSelection=new Set(openCard(null,editId).filter(t=>$('fAll').checked||dueMonth(t.date)===$('fFm').value).map(t=>t.id));}
let invoiceSelection=new Set();
function drawInvoiceForm(ex){
  ex=ex===undefined?editId:ex;
  const fmSel=$('fFm').value||nearestDueMonth($('fDate').value||today());
  $('fmRange').textContent='Compras de '+formatDateBR(cycleStart(fmSel))+' a '+formatDateBR(closeDateOf(fmSel))+' · vence em '+formatDateBR(dueDateOf(fmSel));
  const open=openCard(null,ex).filter(t=>$('fAll').checked||dueMonth(t.date)===fmSel).sort((a,b)=>a.date.localeCompare(b.date));
  invoiceSelection=new Set([...invoiceSelection].filter(id=>open.some(t=>t.id===id)));
  $('fatList').innerHTML=open.length?open.map(t=>`<div style="display:flex;gap:10px;align-items:center;margin:0 0 6px;font-size:14px"><input type="checkbox" data-fi="${t.id}" ${invoiceSelection.has(t.id)?'checked':''} style="width:auto" aria-label="Incluir na fatura"><span class="fitem" data-fe="${t.id}" title="Clique para editar" style="flex:1;cursor:pointer">${formatDateBR(t.date)} · ${icon('despesa',t.cat)} ${esc(t.cat)} <span class="mut">${esc(t.desc||'')}</span> <span class="mut" style="font-size:12px">✎</span></span><b>${f2(t.value)}</b></div>`).join(''):'<div class="help" style="margin:0">Nenhuma compra de cartão em aberto. A fatura inteira entrará como “Cartão (sem detalhe)”.</div>';
  document.querySelectorAll('[data-fi]').forEach(el=>el.onchange=()=>{el.checked?invoiceSelection.add(+el.dataset.fi):invoiceSelection.delete(+el.dataset.fi);updateInvoiceSummary();});
  document.querySelectorAll('[data-fe]').forEach(el=>el.onclick=()=>openItem(+el.dataset.fe));
  updateInvoiceSummary();
}
function selectedInvoiceTotal(){return sum([...invoiceSelection].map(id=>(S.tx.find(x=>x.id===id)||{value:0}).value));}
function updateInvoiceSummary(){
  if(type!=='fatura')return;
  const sel=selectedInvoiceTotal(),v=parse($('fVal').value),rest=v-sel;
  $('fatSum').innerHTML=`Marcadas: <b>${f2(sel)}</b>`+(v>0?` · Fatura: <b>${f2(v)}</b> · Sem detalhe: <b class="${rest<0?'neg':''}">${f2(rest)}</b>`+(rest<-0.004?` <span class="neg">· as marcadas passam da fatura: corrija os valores ou desmarque</span>`:''):'');
}

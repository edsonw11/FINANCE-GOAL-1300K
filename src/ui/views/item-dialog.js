/**
 * ui/views/item-dialog.js
 * Responsibility: Pop-up for a single card purchase (create, edit, delete).
 */
// ---- pop-up for a card purchase ----
let dlgId=null;
function openItem(id,defDate){
  dlgId=id;const t=id?S.tx.find(x=>x.id===id):null;
  $('itemTitle').textContent=t?'Editar compra':'Adicionar compra esquecida';
  $('dCat').value=t?t.cat:'';$('dDesc').value=t?(t.desc||''):'';$('dVal').value=t?m2(t.value):'';
  $('dDate').value=t?t.date:(defDate||$('fDate').value||today());$('dDel').style.display=t?'':'none';
  const sib=t?futureSiblings(t):[];$('dApplyW').style.display=sib.length?'':'none';$('dApply').checked=true;$('dApplyN').textContent=sib.length;
  $('itemDlg').showModal();$('dCat').focus();
}
function bindItemDialog(){
$('nfAdd').onclick=()=>openItem(null);
$('dCancel').onclick=()=>$('itemDlg').close();
$('itemForm').onsubmit=e=>{e.preventDefault();$('dSave').click();};
$('dSave').onclick=()=>{
  const cat=$('dCat').value.trim(),desc=$('dDesc').value.trim(),v=parse($('dVal').value),date=$('dDate').value;
  if(!cat)return toast('⚠️ Informe a categoria');if(!(v>0))return toast('⚠️ Informe o valor');if(!date)return toast('⚠️ Informe a data');
  ensureCat('despesa',cat);let nSib=0;
  if(dlgId){const t=S.tx.find(x=>x.id===dlgId);if(t){const sibs=$('dApply').checked?futureSiblings(t):[];t.cat=cat;t.desc=desc;t.value=v;t.date=date;sibs.forEach(x=>{x.cat=cat;x.desc=desc;x.value=v;});nSib=sibs.length;}}
  else{const id=S.nid++;S.tx.push({id,date,type:'despesa',value:v,desc,cat,fonte:'cartao'});invoiceSelection.add(id);}
  save();$('itemDlg').close();drawInvoiceForm();render();toast(dlgId?'✅ Compra atualizada'+(nSib?' e mais '+nSib+' futura(s)':''):'✅ Compra adicionada à fatura');
};
$('dDel').onclick=()=>{const t=S.tx.find(x=>x.id===dlgId);if(!t)return;
  if(!confirm('Apagar a compra “'+(t.desc||t.cat)+'” de '+f2(t.value)+'?'))return;
  S.tx=S.tx.filter(x=>x.id!==t.id);invoiceSelection.delete(t.id);save();$('itemDlg').close();drawInvoiceForm();render();toast('Compra apagada');};
}

/**
 * ui/views/lancamentos-form.js
 * Responsibility: Transactions tab: form (type, categories, editing and help text).
 */
function startEdit(id){
  const t=S.tx.find(x=>x.id===id);if(!t)return;
  editId=id;type=t.type;document.querySelector(`input[name=tp][value=${t.type}]`).checked=true;fillCategoryOptions();
  $('fDate').value=t.date;$('fVal').value=m2(t.value);$('fDesc').value=t.desc||'';
  if(t.type==='aporte')$('fAcc').value=t.acc;else $('fCat').value=t.cat||'';
  $('fFonte').value=t.fonte||'caixa';
  if(t.type==='fatura'){$('fFm').value=invoiceMonthOf(t);invoiceSelection=new Set(alloc().map[t.id]||[]);drawInvoiceForm(id);}
  splitRows=(t.splits||[]).map(s=>({cat:s.cat,val:s.value}));$('splitBox').style.display=splitRows.length?'':'none';drawSplit();
  const sib=futureSiblings(t);$('wApply').style.display=sib.length?'':'none';$('fApply').checked=true;$('applyN').textContent=sib.length;
  editId=id;$('fSave').textContent='Salvar alteração';$('fCancel').style.display='';$('fRep').disabled=true;
  document.querySelector('nav button[data-t=lanc]').click();window.scrollTo({top:0,behavior:'smooth'});
}
function endEdit(){resetSplit();invoiceSelection=new Set();$('wApply').style.display='none';editId=null;$('fSave').textContent='Adicionar';$('fCancel').style.display='none';$('fRep').disabled=false;payAdvanced=false;fillCategoryOptions();}
function fillCategoryOptions(){
  const set=new Set(((S.cats||{})[type]||[]).filter(c=>!c.off).map(c=>c.name));
  $('catList').innerHTML=[...set].map(c=>`<option value="${esc(c)}">`).join('');
  $('wCat').style.display=type==='aporte'?'none':'';$('wAcc').style.display=type==='aporte'?'':'none';
  const kf=$('fFonte').value;
  $('lFonte').textContent=type==='receita'?'Entrou em':'Pago com';
  $('fFonte').innerHTML=type==='receita'
    ?`<option value="caixa">Conta (entra no caixa)</option><option value="beneficio">VR/VA (cartão benefício)</option>`
    :`<option value="caixa">Conta / Pix / débito</option><option value="cartao">Cartão de crédito</option><option value="beneficio">VR/VA (cartão benefício)</option>`;
  if(kf&&[...$('fFonte').options].some(o=>o.value===kf))$('fFonte').value=kf;
  const noCat=type==='aporte'||type==='fatura';
  $('wCat').style.display=noCat?'none':'';
  $('wFonte').style.display=noCat?'none':'';$('wSplit').style.display=noCat?'none':'';
  const quick=isQuickPay();
  $('fGrid').style.display=quick?'none':'';$('fActions').style.display=quick?'none':'';
  $('fatBox').style.display=(type==='fatura'&&!quick)?'':'none';$('payBox').style.display=quick?'':'none';
  if(type==='fatura'&&!quick)drawInvoiceForm();if(quick)renderPay();
  updateFormHelp();
  const keep=$('fAcc').value;
  $('fAcc').innerHTML=active().map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if(keep)$('fAcc').value=keep;
  updateFormHelp();
}
function cardHint(){const d=$('fDate').value||today(),fm=dueMonth(d);
  return 'Entra na fatura que vence em '+formatDateBR(dueDateOf(fm))+' (ciclo fecha em '+formatDateBR(closeDateOf(fm))+'; a partir de '+formatDateBR(addDay(closeDateOf(fm),1))+' vai para a seguinte). O dinheiro só sai do caixa em “Pagar fatura”.';}
function updateFormHelp(){
  $('fHelp').textContent=type==='aporte'?'O aporte soma no saldo do investimento escolhido e sai da sua sobra do mês.'
    :type==='fatura'?'Use quando pagar a fatura: o dinheiro sai do caixa, mas não vira gasto de novo (as compras já foram lançadas como “Cartão de crédito”).'
    :(type==='despesa'&&$('fFonte').value==='cartao')?cardHint():'';
}

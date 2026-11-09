/**
 * ui/views/lancamentos-save.js
 * Responsibility: Save a transaction (new, edit, series, contribution, invoice).
 */
function bindTransactionSave(){
// meal-voucher and splits: used in fSave below
$('fSave').onclick=()=>{
  const v=parse($('fVal').value),date=$('fDate').value,cat=$('fCat').value.trim()||(type==='receita'?'Outros':'Imprevistos / Outros');
  if(!date)return toast('⚠️ Escolha a data');if(!(v>0))return toast('⚠️ Digite um valor maior que zero');
  const n=(editId!==null||type==='fatura')?1:+$('fRep').value,desc=$('fDesc').value.trim(),acc=$('fAcc').value;
  const splits=(type==='aporte'||type==='fatura')?[]:splitRows.filter(r=>r.cat.trim()&&r.val>0).map(r=>({cat:r.cat.trim(),value:r.val}));
  if(sum(splits.map(s=>s.value))>v+0.004)return toast('⚠️ As partes somam mais que o valor total');
  if(type==='fatura'&&selectedInvoiceTotal()>v+0.004)return toast('⚠️ As compras marcadas somam mais que o valor da fatura');
  if(type==='despesa'||type==='receita'){ensureCat(type,cat);splits.forEach(sp=>ensureCat(type,sp.cat));}
  const wasEdit=editId!==null;let nSibMain=0;
  const fill=(t,d)=>{if(d)t.date=d;t.type=type;t.value=v;t.desc=desc;delete t.acc;delete t.cat;delete t.fonte;delete t.splits;
    if(type==='aporte')t.acc=acc;
    else if(type==='fatura'){t.cat='Fatura do cartão';t.fm=$('fFm').value;t.items=[...invoiceSelection].filter(id=>S.tx.some(x=>x.id===id));}
    else{t.cat=cat;t.fonte=$('fFonte').value;if(splits.length)t.splits=splits.map(s=>({...s}));}};
  if(wasEdit){
    const old=S.tx.find(t=>t.id===editId);
    if(old){const sibs=$('fApply').checked?futureSiblings(old):[];fill(old,date);sibs.forEach(x=>fill(x));
      nSibMain=sibs.length;}
  }else{
    const serie=n>1?S.nid++:undefined;
    for(let i=0;i<n;i++){const t={id:S.nid++};if(serie)t.serie=serie;fill(t,addMonths(date,i));S.tx.push(t);}
  }
  cur=mOf(date);save();render();
  $('fVal').value='';$('fDesc').value='';endEdit();
  if(wasEdit)return toast('✅ Lançamento atualizado'+(nSibMain?' e mais '+nSibMain+' futuro(s)':''));
  if(type==='aporte')toast(`🏦 Aporte de ${f2(v)} em ${accName(acc)}. Saldo agora: ${f2(balance(acc,today()).v)}`);
  else if(type==='fatura')toast('💳 Pagamento de fatura de '+f2(v)+' registrado');
  else toast((type==='receita'?'➕ Receita':'➖ Despesa')+' de '+f2(v)+' adicionada'+(n>1?` (${n}x)`:''));
};
}

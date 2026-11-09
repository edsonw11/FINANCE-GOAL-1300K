/**
 * ui/views/lancamentos-list.js
 * Responsibility: Transactions tab: table of the month's transactions.
 */
function paymentTag(t){
  if(t.type==='aporte')return '<span class="mut">—</span>';
  if(t.type==='fatura')return '<span class="tag pay-conta">Conta</span>';
  if(t.fonte==='cartao')return '<span class="tag pay-cartao">Cartão · fatura '+mShort(dueMonth(t.date))+'</span>';
  if(t.fonte==='beneficio')return '<span class="tag pay-vr">VR/VA</span>';
  return `<span class="tag pay-conta">${t.type==='receita'?'Conta':'Pix / conta'}</span>`;
}
function renderTransactions(){
  const ql=q.toLowerCase();
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.f===filt));
  const list=S.tx.filter(t=>mOf(t.date)===cur&&(filt==='todos'||t.type===filt)&&(!ql||((t.desc||'')+' '+(t.cat||'')+' '+(t.acc?accName(t.acc):'')).toLowerCase().includes(ql))).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  $('txTbl').innerHTML=list.length?`<tr><th>Data</th><th>Tipo</th><th>Categoria / Destino</th><th>Pago com</th><th>Descrição</th><th class="r" style="text-align:right">Valor</th><th></th></tr>`+
    list.map(t=>{const sign=t.type==='receita'?'+':(t.type==='despesa'||t.type==='fatura')?'−':'→';const cls=t.type==='receita'?'pos':t.type==='despesa'?'neg':'';
      const lbl=t.type==='aporte'?'🏦 '+esc(accName(t.acc)):t.type==='fatura'?'💳 Pagamento da fatura<br><span class="mut">'+invoiceItems(t).length+' compra(s) identificada(s)'+(invoiceUndetailed(t)>0?' · <b style="color:var(--warn)">'+f2(invoiceUndetailed(t))+' sem detalhe</b>':'')+'</span>':(t.splits&&t.splits.length?catParts(t).map(p=>icon(t.type,p.cat)+' '+esc(p.cat)+' <span class="mut">'+f2(p.value)+'</span>').join('<br>'):icon(t.type,t.cat)+' '+esc(t.cat));
      return `<tr><td>${formatDateBR(t.date)}</td><td><span class="tag ${t.type}">${t.type}</span></td><td>${lbl}</td><td>${paymentTag(t)}</td><td class="mut">${esc(t.desc||'')}</td><td class="r ${cls}" style="text-align:right">${sign} ${f2(t.value)}</td><td style="text-align:right"><button class="btn sm" data-edit="${t.id}">editar</button> <button class="btn sm dng" data-del="${t.id}">${t.type==='fatura'?'cancelar pagamento':'apagar'}</button></td></tr>`;}).join('')
    :`<tr><td class="empty" colspan="7">Nenhum lançamento em ${mLabel(cur)}.</td></tr>`;
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const t=S.tx.find(x=>x.id===+b.dataset.del);if(!t)return;
    if(t.type==='fatura'){if(!cancelPay(t))return;return;}
    S.tx=S.tx.filter(x=>x.id!==t.id);save();render();toast('Lançamento apagado');});
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>startEdit(+b.dataset.edit));
  fillCategoryOptions();
}

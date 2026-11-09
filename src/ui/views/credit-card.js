/**
 * ui/views/cartao.js
 * Responsibility: Card tab: invoices by cycle and the purchases of each invoice.
 */
let selectedCycle=null;
function renderCycles(){
  const t0=today(),fmNow=dueMonth(t0),view=selectedCycle||fmNow;
  const itemsOf=fm=>S.tx.filter(t=>t.type==='despesa'&&t.fonte==='cartao'&&dueMonth(t.date)===fm).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  const buy=fm=>sum(itemsOf(fm).map(t=>t.value));
  const paid=fm=>sum(S.tx.filter(t=>t.type==='fatura'&&invoiceMonthOf(t)===fm).map(t=>t.value));
  const stOf=fm=>{const p2=paid(fm),cdt=closeDateOf(fm),d2=dueDateOf(fm);
    return p2>0?'<span class="tag pay-vr">Paga</span>':t0<=cdt?'<span class="tag pay-cartao">Aberta</span>':t0<=d2?'<span class="tag fatura">Fechada · vence em '+daysBetween(t0,d2)+' dia(s)</span>':'<span class="tag despesa">Vencida, sem pagamento lançado</span>';};
  // invoices table: click a row to filter the list below
  let rows='<tr><th>Fatura (vence em)</th><th>Compras de</th><th>Fecha em (ajustável)</th><th style="text-align:right">Lançado</th><th style="text-align:right">Pago</th><th>Situação</th></tr>';
  for(let i=-1;i<=3;i++){const fm=mKey(mIdx(fmNow)+i),p2=paid(fm),cdt=closeDateOf(fm);
    rows+=`<tr data-cyc="${fm}" style="cursor:pointer${fm===view?';background:color-mix(in srgb,var(--brand) 11%,var(--card))':''}" title="Clique para ver as compras desta fatura"><td><b>${formatDateBR(dueDateOf(fm))}</b>${fm===fmNow?' <span class="mut" style="font-size:12px">· atual</span>':''}</td><td>${formatDateBR(cycleStart(fm))}</td><td><input type="date" class="ci" data-over="${fm}" value="${cdt}" style="width:150px" title="Ajuste se o banco mostrar outra data"></td><td style="text-align:right">${f2(buy(fm))}</td><td style="text-align:right">${p2?f2(p2):'—'}</td><td>${stOf(fm)}</td></tr>`;}
  const tableCard=`<div class="card" style="margin-bottom:14px"><div style="font-weight:700;margin-bottom:6px">Faturas do cartão <span class="mut" style="font-weight:500;font-size:13px">· melhor dia de compra: dia ${CARD().best} · vence dia ${CARD().due} · clique numa fatura para ver as compras</span></div><div class="scroll"><table class="tl">${rows}</table></div></div>`;
  // details of the selected invoice
  const dd=dueDateOf(view),cd=closeDateOf(view),st=cycleStart(view),its=itemsOf(view),tot=buy(view),left=daysBetween(t0,cd),nextFm=mKey(mIdx(view)+1);
  const rel=view===fmNow?'Fatura atual':mIdx(view)>mIdx(fmNow)?'Próxima fatura':'Fatura anterior';
  const deadline=t0<=cd?`<div style="font-size:14px;margin-top:6px">⏳ <b>Último dia para comprar nesta fatura: ${formatDateBR(cd)}</b> · ${left>0?'faltam '+left+' dia(s)':'é hoje'}. A partir de ${formatDateBR(addDay(cd,1))} as compras vão para a fatura de ${formatDateBR(dueDateOf(nextFm))}.</div>`:`<div class="help" style="margin-top:6px">Fatura fechada em ${formatDateBR(cd)}.</div>`;
  const body=its.length?`<tr><th>Data</th><th>Categoria</th><th>Descrição</th><th style="text-align:right">Valor</th><th></th></tr>`+its.map(t=>`<tr><td>${formatDateBR(t.date)}</td><td>${icon('despesa',t.cat)} ${esc(t.cat)}</td><td class="mut">${esc(t.desc||'')}</td><td style="text-align:right">${f2(t.value)}</td><td style="text-align:right;white-space:nowrap"><button class="btn sm" data-ie="${t.id}">editar</button> <button class="btn sm dng" data-ix="${t.id}">apagar</button></td></tr>`).join('')+`<tr><td colspan="3"><b>Total da fatura</b></td><td style="text-align:right"><b>${f2(tot)}</b></td><td></td></tr>`:'<tr><td class="empty" colspan="5">Nenhuma compra de cartão lançada nesta fatura ainda.</td></tr>';
  const detail=`<div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--c1) 8%,var(--card)),var(--card) 60%)">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div style="font-size:12.5px;color:var(--ink2);font-weight:600;text-transform:uppercase;letter-spacing:.06em">${rel} · vence em ${formatDateBR(dd)}</div>${stOf(view)}</div>
    <div style="font-size:32px;font-weight:800;letter-spacing:-.03em;margin:4px 0">${f2(tot)}</div>
    <div style="font-size:14px;color:var(--ink2)">${its.length} compra(s) de ${formatDateBR(st)} até ${formatDateBR(cd)}</div>
    ${deadline}
    <div class="scroll" style="margin-top:12px"><table class="tl">${body}</table></div>
    <div style="margin-top:12px"><button class="btn pri" id="cycAdd">+ Adicionar compra nesta fatura</button></div>
  </div>`;
  $('cycleBox').innerHTML=tableCard+detail;
  document.querySelectorAll('tr[data-cyc]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('input'))return;selectedCycle=tr.dataset.cyc;renderCycles();});
  document.querySelectorAll('[data-over]').forEach(el=>{brField(el,'date');});
  document.querySelectorAll('[data-over]').forEach(el=>el.onchange=()=>{const c=CARD();c.over=c.over||{};
    if(el.value&&el.value!==ruleClosing(el.dataset.over))c.over[el.dataset.over]=el.value;else delete c.over[el.dataset.over];save();render();toast('Fechamento ajustado');});
  document.querySelectorAll('[data-ie]').forEach(el=>el.onclick=()=>openItem(+el.dataset.ie));
  document.querySelectorAll('[data-ix]').forEach(el=>el.onclick=()=>{const t=S.tx.find(x=>x.id===+el.dataset.ix);if(!t||!confirm('Apagar a compra “'+(t.desc||t.cat)+'” de '+f2(t.value)+'?'))return;S.tx=S.tx.filter(x=>x.id!==t.id);save();render();toast('Compra apagada');});
  $('cycAdd').onclick=()=>openItem(null,t0>=st&&t0<=cd?t0:(t0<st?st:cd));
}
function renderCardBox(){
  const fs=txIn(cur,'fatura').sort((a,b)=>a.date.localeCompare(b.date)),open=openCard(monthEnd(cur)).sort((a,b)=>a.date.localeCompare(b.date));
  const row=(d,c,desc,v,warn)=>`<tr${warn?' style="background:color-mix(in srgb,var(--warn) 16%,var(--card))"':''}><td>${d}</td><td>${c}</td><td class="mut">${desc}</td><td style="text-align:right">${f2(v)}</td></tr>`;
  const head='<tr><th>Data</th><th>Categoria</th><th>Descrição</th><th style="text-align:right">Valor</th></tr>';
  const itemRow=t=>row(formatDateBR(t.date),icon('despesa',t.cat)+' '+esc(t.cat),esc(t.desc||''),t.value);
  let h='';
  fs.forEach(f=>{const its=invoiceItems(f),u=invoiceUndetailed(f);
    h+=`<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:6px"><span>💳 Fatura paga em ${formatDateBR(f.date)}${f.desc?' · '+esc(f.desc):''}</span><span>${f2(f.value)}</span></div><div class="scroll"><table class="tl">${head}${its.map(itemRow).join('')}${u>0?row('—','❓ Sem descrição','Gasto no cartão que você ainda não lançou (ex.: Uber)',u,true):''}</table></div>${u>0?`<div class="row" style="margin-top:10px;align-items:flex-end"><div class="f" style="flex:2"><label>Classificar o que sobrou · categoria</label><input list="catListD" data-clc="${f.id}" placeholder="Ex.: Transporte"></div><div class="f" style="flex:2"><label>Descrição</label><input data-cld="${f.id}" placeholder="Ex.: Uber"></div><div class="f"><label>Valor (R$)</label><input data-clv="${f.id}" inputmode="decimal" value="${m2(u)}"></div><button class="btn sm pri" data-cls="${f.id}" style="height:42px">Classificar</button></div>`:''}</div>`;});
  if(!h)h='<div class="empty">Nenhuma fatura paga neste mês. As compras de cada fatura aparecem acima.</div>';
  $('cardBox').innerHTML=h;
  const cs=new Set(((S.cats||{}).despesa||[]).filter(c=>!c.off).map(c=>c.name));
  $('catListD').innerHTML=[...cs].map(c=>`<option value="${esc(c)}">`).join('');
  document.querySelectorAll('[data-cls]').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.cls,f=S.tx.find(x=>x.id===id);if(!f)return;
    const cat=document.querySelector(`[data-clc="${id}"]`).value.trim(),desc=document.querySelector(`[data-cld="${id}"]`).value.trim(),v=parse(document.querySelector(`[data-clv="${id}"]`).value);
    if(!cat)return toast('⚠️ Informe a categoria');
    if(!(v>0)||v>invoiceUndetailed(f)+0.004)return toast('⚠️ O valor deve ser maior que zero e até '+f2(invoiceUndetailed(f)));
    ensureCat('despesa',cat);const nid=S.nid++,cur_items=alloc().map[f.id]||[];
    S.tx.push({id:nid,date:f.date,type:'despesa',value:v,desc,cat,fonte:'cartao'});
    f.items=cur_items.concat(nid);save();render();toast('✅ '+f2(v)+' classificado como '+cat);});
}

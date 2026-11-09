/**
 * ui/views/pagar-fatura.js
 * Responsibility: Pay invoice (quick mode): pick the invoice, full or partial amount, confirm and cancel a payment.
 */
// ---- pay invoice (quick mode): pick the invoice and the amount, no date/description ----
let payAdvanced=false,paySel=null,payMode='total';
const isQuickPay=()=>type==='fatura'&&editId===null&&!payAdvanced;
let payOpen=null,payIds=null,payIdsFm=null;
function cancelPay(t){
  if(!confirm('Cancelar o pagamento da fatura que vence em '+formatDateBR(dueDateOf(invoiceMonthOf(t)))+'?\n\nValor: '+f2(t.value)+' (pago em '+formatDateBR(t.date)+')\n\nO dinheiro volta para o seu caixa e a fatura volta a ficar em aberto. As compras do cartão não são apagadas.'))return false;
  S.tx=S.tx.filter(x=>x.id!==t.id);payIds=null;save();render();toast('↩️ Pagamento cancelado: a fatura voltou a ficar em aberto');return true;}
function paidInvoicesList(){
  const ps=S.tx.filter(t=>t.type==='fatura').sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,5);
  if(!ps.length)return '';
  return `<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:12px"><div style="font-weight:700;margin-bottom:8px">Pagamentos já registrados <span class="mut" style="font-weight:500;font-size:12.5px">· pagou sem querer? cancele aqui</span></div>`+
    ps.map(t=>`<div style="display:flex;gap:10px;align-items:center;margin:0 0 6px;font-size:14px"><span style="flex:1;color:var(--ink)">💳 Fatura de ${formatDateBR(dueDateOf(invoiceMonthOf(t)))} <span class="mut">· paga em ${formatDateBR(t.date)}</span></span><b>${f2(t.value)}</b><button type="button" class="btn sm dng" data-cp="${t.id}">cancelar pagamento</button></div>`).join('')+'</div>';}
function bindPaidInvoices(box){box.querySelectorAll('[data-cp]').forEach(b=>b.onclick=()=>{const t=S.tx.find(x=>x.id===+b.dataset.cp);if(t)cancelPay(t);});}
function renderPay(){
  const L=payableInvoices(),box=$('payBox'),t0=today();
  if(!L.length){box.innerHTML='<div class="empty" style="padding:18px">Nenhuma fatura em aberto. Lance as compras com “Cartão de crédito” para elas aparecerem aqui.</div><div style="text-align:center"><button type="button" class="btn sm" id="payAdv">Registrar pagamento manualmente</button></div>'+paidInvoicesList();bindPaidInvoices(box);$('payAdv').onclick=()=>{payAdvanced=true;fillCategoryOptions();};return;}
  if(payOpen===null){const nf=nearestDueMonth(t0);payOpen=(L.find(f=>f.fm===nf)||L[0]).fm;}
  if(payOpen&&!L.some(f=>f.fm===payOpen))payOpen=L[0].fm;
  paySel=payOpen;
  const fmNow=dueMonth(t0),head=L.filter(f=>f.fm<=fmNow),fut=L.filter(f=>f.fm>fmNow);
  const f=L.find(x=>x.fm===payOpen);
  let its=[];
  if(f){its=payableItems(f.fm);if(payIdsFm!==f.fm||!payIds){payIds=new Set(its.map(t=>t.id));payIdsFm=f.fm;}else payIds=new Set([...payIds].filter(id=>its.some(t=>t.id===id)));}
  const selTot=its.length?sum(its.filter(t=>payIds.has(t.id)).map(t=>t.value)):0,all=its.length>0&&payIds.size===its.length;
  const body=x=>{
    const amtAll=all||!its.length?x.rest:selTot,total=payMode==='total';
    return `<div style="padding:4px 14px 14px">
      <div class="help" style="margin:0 0 8px">Compras desta fatura (${formatDateBR(cycleStart(x.fm))} a ${formatDateBR(closeDateOf(x.fm))}). Desmarque o que não entra neste pagamento. Clique numa compra para editar.</div>
      ${its.length?its.map(t=>`<div style="display:flex;gap:10px;align-items:center;margin:0 0 6px;font-size:14px"><input type="checkbox" data-pi="${t.id}" ${payIds.has(t.id)?'checked':''} style="width:auto" aria-label="Incluir"><span data-pe="${t.id}" title="Clique para editar" style="flex:1;cursor:pointer;color:var(--ink)">${formatDateBR(t.date)} · ${icon('despesa',t.cat)} ${esc(t.cat)} <span class="mut">${esc(t.desc||'')}</span> <span class="mut" style="font-size:12px">✎</span></span><b>${f2(t.value)}</b></div>`).join(''):'<div class="help" style="margin:0">Sem compras em aberto listadas.</div>'}
      <div style="margin:8px 0 14px"><button type="button" class="btn sm" id="payNew">+ Adicionar compra esquecida</button></div>
      <div style="border-top:1px solid var(--line);padding-top:12px">
      <label style="display:flex;gap:10px;align-items:center;margin:0 0 8px;font-weight:500;color:var(--ink);cursor:pointer"><input type="radio" name="payM" value="total" ${total?'checked':''} style="width:auto">${all||!its.length?'Valor completo':'Só as compras marcadas'}: <b>${f2(amtAll)}</b></label>
      <label style="display:flex;gap:10px;align-items:center;margin:0;font-weight:500;color:var(--ink);cursor:pointer"><input type="radio" name="payM" value="part" ${total?'':'checked'} style="width:auto">Pagar outro valor (parcial)</label>
      <div id="payPartW" style="margin:8px 0 0 26px;max-width:220px;${total?'display:none':''}"><input id="payVal" inputmode="decimal" placeholder="0,00"></div>
      <div class="row" style="margin-top:14px;align-items:center"><button type="button" class="btn pri" id="payGo">💳 Pagar fatura</button><span class="help" style="margin:0">Registrado hoje, ${formatDateBR(t0)}. Sai do caixa e não conta como gasto de novo.</span></div></div></div>`;};
  const acc=x=>{const on=x.fm===payOpen,dd=dueDateOf(x.fm),late=dd<t0;
    return `<div style="border:1px solid ${on?'var(--brand)':'var(--line)'};border-radius:12px;margin:0 0 8px;overflow:hidden;${on?'background:color-mix(in srgb,var(--brand) 5%,var(--card))':''}"><div data-pa="${x.fm}" style="display:flex;gap:12px;align-items:center;padding:12px 14px;cursor:pointer"><span style="width:14px;color:var(--muted)">${on?'▾':'▸'}</span><span style="flex:1"><b style="font-size:15px;color:var(--ink)">Vence em ${formatDateBR(dd)}</b><br><span class="mut" style="font-size:12.5px">${x.n} compra(s)${x.paid>0?' · já pago '+f2(x.paid):''}${late?' · <b style="color:var(--bad)">vencida</b>':''}</span></span><b style="font-size:18px;color:var(--ink)">${f2(x.rest)}</b></div>${on?body(x):''}</div>`;};
  const futOpen=fut.some(x=>x.fm===payOpen);
  box.innerHTML=`<div style="font-weight:700;margin-bottom:10px">Qual fatura você vai pagar?</div>${head.map(acc).join('')||'<div class="help">Nenhuma fatura atual ou vencida em aberto.</div>'}
    ${fut.length?`<details id="payFut" ${futOpen?'open':''} style="margin-top:6px"><summary style="cursor:pointer;color:var(--ink2);font-weight:600;padding:8px 2px">Faturas futuras (${fut.length}) · ${f2(sum(fut.map(x=>x.rest)))}</summary><div style="margin-top:6px">${fut.map(acc).join('')}</div></details>`:''}
    ${paidInvoicesList()}
    <div style="margin-top:12px"><button type="button" class="btn sm" id="payAdv" style="background:transparent;border-color:transparent;color:var(--muted)">Avançado: informar data, valor e compras manualmente</button></div>`;
  bindPaidInvoices(box);
  box.querySelectorAll('[data-pa]').forEach(el=>el.onclick=()=>{const fm=el.dataset.pa;payOpen=(payOpen===fm)?'':fm;if(payOpen)payIds=null;payMode='total';renderPay();});
  box.querySelectorAll('[data-pi]').forEach(el=>el.onchange=()=>{el.checked?payIds.add(+el.dataset.pi):payIds.delete(+el.dataset.pi);renderPay();});
  box.querySelectorAll('[data-pe]').forEach(el=>el.onclick=()=>openItem(+el.dataset.pe));
  box.querySelectorAll('input[name=payM]').forEach(r=>r.onchange=()=>{payMode=r.value;renderPay();if(payMode==='part')$('payVal').focus();});
  $('payAdv').onclick=()=>{const fx=f||L[0];payAdvanced=true;fillCategoryOptions();$('fDate').value=t0;$('fFm').value=fx.fm;$('fVal').value=m2(fx.rest);initInvoiceForm();$('fFm').value=fx.fm;drawInvoiceForm();};
  if(!f)return;
  $('payNew').onclick=()=>{const st=cycleStart(f.fm),cd=closeDateOf(f.fm);openItem(null,t0>=st&&t0<=cd?t0:(t0<st?st:cd));};
  $('payGo').onclick=()=>{
    const partial=payMode==='part',v=partial?parse($('payVal').value):(all||!its.length?f.rest:selTot);
    if(!(v>0))return toast(partial?'⚠️ Digite o valor que vai pagar':'⚠️ Marque pelo menos uma compra');
    const full=v>=f.rest-0.004,msg=(full?'Pagar a fatura que vence em ':'Pagar PARCIALMENTE a fatura que vence em ')+formatDateBR(dueDateOf(f.fm))+'?\n\nValor: '+f2(v)+(full?'':'\nFalta depois do pagamento: '+f2(f.rest-v))+(v>f.rest+0.004?'\n\n⚠️ O valor é maior que o da fatura ('+f2(f.rest)+').':'')+'\nData: hoje, '+formatDateBR(t0)+'\n\nConfirmar?';
    if(!confirm(msg))return;
    const tx={id:S.nid++,type:'fatura',date:t0,value:Math.round(v*100)/100,desc:'',cat:'Fatura do cartão',fm:f.fm};
    if(!partial&&!all&&its.length)tx.items=[...payIds];
    S.tx.push(tx);
    payMode='total';payIds=null;cur=mOf(t0);save();render();
    toast('💳 '+(v>=f.rest-0.004?'Fatura de ':'Pagamento de ')+formatDateBR(dueDateOf(f.fm))+' paga: '+f2(v));};
}

/**
 * ui/views/investimentos.js
 * Responsibility: Investments tab: accounts and balances.
 */
function renderInvestments(){
  const d=today();
  $('accList').innerHTML=active().map(a=>{const b=balance(a.id,d);const sn=b.snap;
    const sub=sn?`Saldo informado em ${formatDateBR(sn.date)}${sn.est?' (estimado 🟠)':''}${b.v!==sn.value?' + aportes depois':''}`:'Sem saldo informado';
    return `<div class="acc"><i style="background:${accColor(a.id)}"></i><div class="nm">${esc(a.name)}<span class="sb">${sub}</span></div><button class="btn sm" data-arq="${a.id}" title="Remover da lista (o histórico é mantido)">arquivar</button><div class="vl" style="text-align:right">${f2(b.v)}<span class="sb" style="font-weight:500">${b.g!==null?'bruto '+f2(b.g)+' · IR '+f2(b.g-b.v):'bruto não informado'}</span></div></div>`;}).join('')+
    (()=>{const tg=totalGross(d);return `<div class="acc"><i style="background:var(--line)"></i><div class="nm">Total<span class="sb">líquido (o que você recebe ao resgatar)</span></div><div class="vl" style="text-align:right">${f2(total(d))}<span class="sb" style="font-weight:500">${tg.ok?'':'≈ '}bruto ${f2(tg.g)} · IR embutido ${f2(tg.g-total(d))}</span></div></div>`;})();
  $('snapForm').innerHTML=`<div style="grid-column:1/-1;display:grid;grid-template-columns:minmax(120px,1.2fr) 1fr 1fr;gap:10px" class="help"><span></span><b>Saldo líquido (R$)</b><b>Saldo bruto (R$, opcional)</b></div>`+
    active().map(a=>{const b=balance(a.id,d);return `<div style="grid-column:1/-1;display:grid;grid-template-columns:minmax(120px,1.2fr) 1fr 1fr;gap:10px;align-items:center"><label for="s_${a.id}" style="margin:0"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${accColor(a.id)};margin-right:6px"></i>${esc(a.name)}</label><input id="s_${a.id}" inputmode="decimal" value="${m2(b.v)}"><input id="g_${a.id}" inputmode="decimal" placeholder="igual ao do app" value="${b.g!==null?m2(b.g):''}"></div>`;}).join('');
  $('snapDate').value=d;
  const real=realSeries();
  $('histTbl').innerHTML=`<tr><th>Mês</th><th>Patrimônio</th><th>Aportes</th><th>Rendimento</th><th>% no mês</th><th>Esperado</th></tr>`+
    [...real].reverse().map(r=>{const exp=r.prev!==null?r.prev*(Math.pow(1+S.rate/100,1/12)-1):null;
      const cls=r.y===null?'':(r.y>=exp?'pos':'neg');
      return `<tr><td>${mShort(r.m)}</td><td>${f2(r.t)}</td><td>${r.ap?f2(r.ap):'—'}</td><td class="${cls}">${r.y===null?'—':f2(r.y)}</td><td class="${cls}">${r.y===null?'—':pc(r.y/r.prev)}</td><td class="mut">${exp===null?'—':f2(exp)}</td></tr>`;}).join('');
}

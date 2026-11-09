/**
 * ui/views/resumo-flow.js
 * Responsibility: Summary tab: month KPIs, income x expenses x contributions chart and spending by category.
 */
function renderFlow(){
  $('mLab1').textContent=$('mLab2').textContent=$('mLab3').textContent=mLabel(cur);
  const rec=sum(txIn(cur,'receita').map(t=>t.value)),des=sum(txIn(cur,'despesa').map(t=>t.value))+undetailedInMonth(cur),apo=sum(txIn(cur,'aporte').map(t=>t.value)),
    ben=t=>t.fonte==='beneficio',recC=sum(txIn(cur,'receita').filter(t=>!ben(t)).map(t=>t.value)),crd=t=>t.fonte==='cartao',desC=sum(txIn(cur,'despesa').filter(t=>!ben(t)&&!crd(t)).map(t=>t.value)),fatPaid=sum(txIn(cur,'fatura').map(t=>t.value)),sob=recC-desC-fatPaid-apo,
    fatBuy=sum(txIn(cur,'despesa').filter(crd).map(t=>t.value)),
    fatOpen=sum(openCard(monthEnd(cur)).map(t=>t.value)),
    vrIn=sum(txIn(cur,'receita').filter(ben).map(t=>t.value)),vrOut=sum(txIn(cur,'despesa').filter(ben).map(t=>t.value)),
    vrBal=sum(S.tx.filter(t=>ben(t)&&t.date<=monthEnd(cur)).map(t=>t.type==='receita'?t.value:t.type==='despesa'?-t.value:0));
  $('kFlow').innerHTML=
    kpi('rec','➕','Receitas',f2(rec),'Entradas do mês')+
    kpi('des','➖','Despesas',f2(des),rec?`${pc(des/rec)} das receitas`:'Gastos do mês')+
    kpi('apo','🏦','Aportes (investido)',f2(apo),rec?`${pc(apo/rec)} das receitas`:'Dinheiro enviado aos investimentos')+
    kpi('','🧮','Sobrou no caixa',`<span class="${sob>=0?'pos':'neg'}">${sob<0?'−':''}${f2(Math.abs(sob))}</span>`,'Receitas − saídas da conta − faturas pagas − aportes')+
    kpi('des','💳','Fatura em aberto',f2(fatOpen),`Compras de cartão ainda sem fatura paga. Compras no mês: ${f2(fatBuy)} · fatura paga no mês: ${f2(fatPaid)}`)+
    kpi('','💰','Saldo VR/VA',f2(vrBal),`Recebido ${f2(vrIn)} · gasto ${f2(vrOut)} no mês`);
  // 6 months
  const idx=mIdx(cur),ms=[];for(let i=idx-5;i<=idx;i++)ms.push(mKey(i));
  const data=ms.map(m=>[sum(txIn(m,'receita').map(t=>t.value)),sum(txIn(m,'despesa').map(t=>t.value))+undetailedInMonth(m),sum(txIn(m,'aporte').map(t=>t.value))]);
  const mx=Math.max(1000,...data.flat())*1.15,W=560,H=270,L=48,B=30,T=20,pw=W-L-8,ph=H-T-B,gw=pw/6,bw=gw*0.24;
  const col=['--rec','--des','--apo'],nm=['Receitas','Despesas','Aportes'];
  let s='';
  for(let k=0;k<=4;k++){const v=mx/4*k,yy=T+ph-v/mx*ph;s+=`<line x1="${L}" x2="${W-8}" y1="${yy}" y2="${yy}" stroke="${css('--line')}"/><text x="${L-6}" y="${yy+4}" text-anchor="end" font-size="11" fill="${css('--muted')}">${v>=1000?(v/1000).toFixed(0)+'k':'0'}</text>`;}
  ms.forEach((m,i)=>{const gx=L+i*gw+gw*0.14;
    data[i].forEach((v,k)=>{const h=v/mx*ph,x=gx+k*(bw+3);
      if(v>0)s+=`<path d="${rr(x,T+ph-h,bw,h,3)}" fill="${css(col[k])}"><title>${mLabel(m)} · ${nm[k]}: ${f2(v)}</title></path>`;});
    s+=`<text x="${L+i*gw+gw/2}" y="${H-10}" text-anchor="middle" font-size="12" font-weight="${m===cur?800:400}" fill="${css(m===cur?'--ink':'--ink2')}">${mShort(m)}</text>`;});
  const sv=$('chFlow');sv.setAttribute('viewBox',`0 0 ${W} ${H}`);sv.innerHTML=s;
  // categories
  const cats={};txIn(cur,'despesa').forEach(t=>catParts(t).forEach(p=>cats[p.cat]=(cats[p.cat]||0)+p.value));
  const prevM=mKey(mIdx(cur)-1),pcats={};txIn(prevM,'despesa').forEach(t=>catParts(t).forEach(p=>pcats[p.cat]=(pcats[p.cat]||0)+p.value));
  txIn(cur,'fatura').forEach(t=>{const u=invoiceUndetailed(t);if(u>0)cats['Cartão (sem detalhe)']=(cats['Cartão (sem detalhe)']||0)+u;});
  txIn(prevM,'fatura').forEach(t=>{const u=invoiceUndetailed(t);if(u>0)pcats['Cartão (sem detalhe)']=(pcats['Cartão (sem detalhe)']||0)+u;});
  const arr=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  $('cats').innerHTML=arr.length?arr.map(([c,v])=>{const p=pcats[c];let d='<span class="mut">—</span>';
      if(p){const dl=(v-p)/p;d=`<span class="${dl>0?'neg':'pos'}">${dl>0?'▲':'▼'} ${Math.abs(Math.round(dl*100))}%</span>`;}
      return `<div class="catrow"><div>${icon('despesa',c)} ${esc(c)}</div><div class="catbar"><div style="width:${v/arr[0][1]*100}%"></div></div><div style="text-align:right;font-weight:700">${f2(v)}</div><div style="text-align:right;font-size:12.5px" title="vs mês anterior">${d}</div></div>`;}).join('')
    :'<div class="empty">Nenhuma despesa neste mês.<br>Adicione em 🧾 Lançamentos.</div>';
}

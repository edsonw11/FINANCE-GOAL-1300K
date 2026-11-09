/**
 * ui/views/resumo-insights.js
 * Responsibility: Summary tab: spending analysis (KPIs, reading of the data, per-category table and month-by-month pop-up).
 */
let selectedInsightCategory=null;
function markSel(box,tr){box.querySelectorAll('[data-cm]').forEach(x=>{const on=x===tr;x.classList.toggle('rowsel',on);
  x.querySelectorAll('td').forEach((td,i)=>{td.style.background=on?'color-mix(in srgb,var(--ink) 9%,var(--card))':'';td.style.boxShadow=on&&i===0?'inset 4px 0 0 var(--brand)':'';});});}
function renderInsights(ms,vals,ci){
  const box=$('trendIns');
  if(ci.length<1){box.innerHTML='';return;}
  const cl=ci.map(k=>({m:ms[k],v:vals[k],c:catMonth(ms[k])})),N=cl.length,tot=sum(cl.map(x=>x.v)),avg=tot/N,last=cl[N-1];
  const names=[...new Set(cl.flatMap(x=>Object.keys(x.c)))];
  const P=x=>Math.abs(x*100).toFixed(0)+'%',P1=x=>Math.abs(x*100).toFixed(1).replace('.',',')+'%';
  // per-category statistics
  const st=names.map(c=>{const a=cl.map(x=>x.c[c]||0),t=sum(a),mean=t/N,sd=Math.sqrt(sum(a.map(z=>(z-mean)**2))/N),freq=a.filter(z=>z>0).length/N,cv=mean?sd/mean:0;
    const prev=a.slice(Math.max(0,N-4),N-1),base=prev.length?sum(prev)/prev.length:null,cur_=a[N-1];
    const kind=freq<0.5?'Pontual':cv<=0.15?'Fixo':'Variável';
    return {c,a,t,mean,cv,freq,kind,base,cur:cur_,d:base===null?null:cur_-base,p:base>0?(cur_-base)/base:null,share:t/tot};}).sort((x,y)=>y.t-x.t);
  const fixed=sum(st.filter(z=>z.kind==='Fixo').map(z=>z.mean)),vari=sum(st.filter(z=>z.kind==='Variável').map(z=>z.mean)),pont=sum(st.filter(z=>z.kind==='Pontual').map(z=>z.mean));
  const top3=sum(st.slice(0,3).map(z=>z.t))/tot,save=vari*0.10;
  const dLast=N>=2?(last.v-(sum(cl.slice(Math.max(0,N-4),N-1).map(x=>x.v))/Math.min(3,N-1))):null,bLast=N>=2?sum(cl.slice(Math.max(0,N-4),N-1).map(x=>x.v))/Math.min(3,N-1):null;
  // trend
  let slope=0,proj=null;if(N>=3){const mx=(N-1)/2;let nu=0,de=0;cl.forEach((x,i)=>{nu+=(i-mx)*(x.v-avg);de+=(i-mx)**2;});slope=nu/de;proj=avg+slope*(N-mx);}
  const tile=(lab,val,sub,tone)=>`<div style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--card)"><div style="font-size:11.5px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.06em">${lab}</div><div style="font-size:23px;font-weight:800;letter-spacing:-.02em;margin:3px 0 1px;${tone?`color:var(--${tone})`:''}">${val}</div><div style="font-size:12.5px;color:var(--ink2)">${sub}</div></div>`;
  const tiles=[
    tile('Média mensal',f0(avg),dLast===null?N+' mês fechado':`${mShort(last.m)}: ${f0(last.v)} (${dLast>=0?'+':'−'}${P(bLast?dLast/bLast:0)} vs média anterior)`),
    tile('Gastos fixos',f0(fixed),`${P(fixed/(fixed+vari+pont||1))} da média · variáveis ${f0(vari)}`),
    tile('Concentração',P(top3),'nas 3 maiores categorias: '+st.slice(0,3).map(z=>esc(z.c.split(' ')[0])).join(', ')),
    tile('Potencial de economia',f0(save)+'/mês',`cortando 10% do variável · ${f0(save*12)} por ano`,'rec')].join('');
  // reading of the data
  const L=[];
  L.push({t:'info',h:'Maior categoria',x:`<b>${esc(st[0].c)}</b> concentra ${P(st[0].share)} do total (${f0(st[0].t)}, média de ${f0(st[0].mean)} por mês).`});
  if(N>=3){const rel=avg?slope/avg:0;
    L.push(Math.abs(rel)<0.03?{t:'good',h:'Tendência estável',x:`Os gastos variam ${f0(Math.abs(slope))} por mês, abaixo de 3% da média. ${proj?'Projeção para o próximo mês: <b>'+f0(proj)+'</b>.':''}`}
      :{t:rel>0?'warn':'good',h:rel>0?'Gastos em alta':'Gastos em queda',x:`Tendência de <b>${slope>0?'+':'−'}${f0(Math.abs(slope))} por mês</b> (${P1(rel)} ao mês, ${P1(rel*12)} ao ano). Projeção para o próximo mês: <b>${f0(proj)}</b>.`});}
  const mv=st.filter(z=>z.d!==null&&z.kind!=='Pontual'&&Math.abs(z.d)>=1),up=mv.filter(z=>z.d>0).sort((a,b)=>b.d-a.d)[0],dn=mv.filter(z=>z.d<0).sort((a,b)=>a.d-b.d)[0];
  if(up)L.push({t:'warn',h:'Maior alta em '+mShort(last.m),x:`<b>${esc(up.c)}</b>: ${f0(up.cur)}, ${f0(up.d)} acima da média dos meses anteriores${up.p!==null?' (+'+P(up.p)+')':''}.`});
  if(dn)L.push({t:'good',h:'Maior queda em '+mShort(last.m),x:`<b>${esc(dn.c)}</b>: ${f0(dn.cur)}, ${f0(Math.abs(dn.d))} abaixo da média dos meses anteriores${dn.p!==null?' (−'+P(dn.p)+')':''}.`});
  if(N>=3){const hi=cl.reduce((a,b)=>b.v>a.v?b:a),drv=st.map(z=>[z.c,(hi.c[z.c]||0)-z.mean]).sort((a,b)=>b[1]-a[1])[0];
    L.push({t:hi.v>avg*1.1?'warn':'info',h:'Pico: '+mShort(hi.m),x:`${f0(hi.v)}, ${P((hi.v-avg)/avg)} acima da média${drv&&drv[1]>1?`. Principal causa: <b>${esc(drv[0])}</b> (+${f0(drv[1])} sobre o normal)`:''}.`});}
  if(pont>0)L.push({t:'info',h:'Gastos pontuais',x:`Categorias que aparecem em poucos meses somam ${f0(pont)} por mês em média (${st.filter(z=>z.kind==='Pontual').map(z=>esc(z.c)).join(', ')}). Vale reservar um valor mensal para eles.`});
  const col={info:'var(--brand)',warn:'var(--warn)',good:'var(--rec)'};
  const lt={info:'Informação',warn:'Atenção',good:'Positivo'};
  const items=L.map(i=>`<div style="border-left:4px solid ${col[i.t]};padding:2px 0 2px 12px;margin:0 0 12px"><div style="font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${col[i.t]}">${lt[i.t]} · ${i.h}</div><div style="font-size:14px;line-height:1.5;margin-top:2px">${i.x}</div></div>`).join('');
  const pill=k=>{const c=k==='Fixo'?'var(--brand)':k==='Variável'?'var(--warn)':'var(--muted)';return `<span style="font-size:11.5px;font-weight:700;color:${c};border:1px solid ${c};border-radius:99px;padding:1px 8px;white-space:nowrap">${k}</span>`;};
  const mx=st[0].t,th='font-size:11.5px;color:var(--ink2);text-transform:uppercase;letter-spacing:.05em;font-weight:700;padding:6px 8px;border-bottom:1px solid var(--line)';
  const rows=st.map((z,ix)=>{
    const v=z.kind==='Pontual'&&z.cur===0?'<span class="mut">sem gasto</span>':z.d===null||Math.abs(z.d)<1?'<span class="mut">estável</span>':`<span class="${z.d>0?'neg':'pos'}" style="font-weight:700">${z.d>0?'▲ +':'▼ −'}${f0(Math.abs(z.d))}${z.p!==null&&z.kind!=='Pontual'?' <span style="font-weight:500">('+P(z.p)+')</span>':''}</span>`;
    return `<tr class="rowclick${z.c===selectedInsightCategory?' rowsel':''}" data-cm="${ix}"><td style="padding:9px 8px;border-bottom:1px solid var(--line);white-space:nowrap">${icon('despesa',z.c)} ${esc(z.c)}</td><td style="padding:9px 8px;border-bottom:1px solid var(--line)">${pill(z.kind)}</td><td style="padding:9px 8px;border-bottom:1px solid var(--line);min-width:150px;width:30%"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:var(--line);border-radius:99px;overflow:hidden"><div style="height:100%;width:${z.t/mx*100}%;background:var(--brand);border-radius:99px"></div></div><span class="mut" style="font-size:12.5px;width:34px;text-align:right">${P(z.share)}</span></div></td><td style="padding:9px 8px;border-bottom:1px solid var(--line);text-align:right"><b>${f0(z.t)}</b></td><td style="padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap">${f0(z.mean)}</td><td style="padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap">${v}</td></tr>`;}).join('');
  box.innerHTML=`<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline"><div style="font-weight:700;font-size:16px">Análise dos gastos</div><div class="help" style="margin:0">${N} mês(es) fechado(s) · ${mShort(cl[0].m)} a ${mShort(last.m)} · total ${f0(tot)}</div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin:12px 0 18px">${tiles}</div>
    <div style="font-size:12px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Leitura dos dados</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:4px 28px;margin-bottom:10px">${items}</div>
    <div style="border-top:1px solid var(--line);padding-top:14px">
      <div><div style="font-size:12px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Por categoria</div><div class="scroll"><table style="width:100%;border-collapse:collapse;font-size:13.5px"><thead><tr><th style="${th};text-align:left">Categoria</th><th style="${th};text-align:left">Perfil</th><th style="${th};text-align:left">Participação</th><th style="${th};text-align:right">Total</th><th style="${th};text-align:right">Média/mês</th><th style="${th};text-align:right">${mShort(last.m)} vs média</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td style="padding:10px 8px;font-weight:800">Total</td><td></td><td style="padding:10px 8px"><span class="mut" style="font-size:12.5px">100%</span></td><td style="padding:10px 8px;text-align:right;font-weight:800">${f0(tot)}</td><td style="padding:10px 8px;text-align:right;font-weight:800;white-space:nowrap">${f0(avg)}</td><td style="padding:10px 8px;text-align:right;white-space:nowrap">${dLast===null?'':`<span class="${dLast>0?'neg':'pos'}" style="font-weight:800">${dLast>=0?'▲ +':'▼ −'}${f0(Math.abs(dLast))}</span>`}</td></tr></tfoot></table></div>
      <div class="help" style="margin:8px 0 0">Clique numa categoria para ver o histórico mês a mês. <b>Fixo</b>: valor quase igual todo mês. <b>Variável</b>: oscila. <b>Pontual</b>: aparece em menos da metade dos meses. A comparação usa a média dos até 3 meses anteriores.</div></div>
    </div>`;
  box.querySelectorAll('.rowsel').forEach(tr=>markSel(box,tr));
  box.querySelectorAll('[data-cm]').forEach(tr=>tr.onclick=()=>{selectedInsightCategory=st[+tr.dataset.cm].c;markSel(box,tr);openCatMonths(selectedInsightCategory,ms,ci);});
}
function openCatMonths(cat,ms,ci){
  const nowM=mOf(today()),rowsD=ms.map((m,k)=>({m,k,v:catMonth(m)[cat]||0,part:m===nowM,closed:ci.includes(k)}));
  const cl=rowsD.filter(r=>r.closed),tot=sum(cl.map(r=>r.v)),pos=cl.filter(r=>r.v>0);
  const hi=pos.length?pos.reduce((a,b)=>b.v>a.v?b:a):null,lo=pos.length?pos.reduce((a,b)=>b.v<a.v?b:a):null,avg=cl.length?tot/cl.length:0;
  const mx=Math.max(...rowsD.map(r=>r.v),1),P=x=>Math.abs(x*100).toFixed(0)+'%';
  const chip=(l,v,sub,c)=>`<div style="border:1px solid var(--line);border-radius:10px;padding:8px 12px;flex:1 1 130px"><div style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.05em">${l}</div><div style="font-size:17px;font-weight:800;${c?'color:var(--'+c+')':''}">${v}</div><div style="font-size:12px;color:var(--ink2)">${sub}</div></div>`;
  const td='padding:8px 8px;border-bottom:1px solid var(--line)';
  let prevV=null;
  const body=rowsD.map(r=>{
    let tag='',cmp='<span class="mut">—</span>';
    if(hi&&r.m===hi.m&&pos.length>1)tag='<span class="neg" style="font-size:11.5px;font-weight:700">MAIOR</span>';
    else if(lo&&r.m===lo.m&&pos.length>1)tag='<span class="pos" style="font-size:11.5px;font-weight:700">MENOR</span>';
    if(prevV!==null&&prevV>0&&r.v>=0){const d=r.v-prevV;cmp=Math.abs(d)<1?'<span class="mut">igual</span>':`<span class="${d>0?'neg':'pos'}" style="font-weight:600">${d>0?'▲ +':'▼ −'}${f0(Math.abs(d))} <span style="font-weight:400">(${P(d/prevV)})</span></span>`;}
    else if(prevV===0&&r.v>0)cmp='<span class="neg" style="font-weight:600">novo</span>';
    prevV=r.v;
    return `<tr><td style="${td};white-space:nowrap;font-weight:${r.m===cur?800:400}">${mLabel(r.m)}${r.part?' <span class="mut" style="font-size:11.5px">(em andamento)</span>':''}</td><td style="${td};min-width:60px;width:18%"><div style="height:8px;background:var(--line);border-radius:99px;overflow:hidden"><div style="height:100%;width:${r.v/mx*100}%;background:${r.part?'var(--muted)':'var(--brand)'};border-radius:99px"></div></div></td><td style="${td};text-align:right;white-space:nowrap"><b>${r.v?f2(r.v):'<span class="mut">—</span>'}</b></td><td style="${td};text-align:right;white-space:nowrap">${cmp}</td><td style="${td}">${tag}</td></tr>`;}).join('');
  $('cmTitle').innerHTML=icon('despesa',cat)+' '+esc(cat);
  $('cmBody').innerHTML=`<div class="row" style="gap:10px;margin:14px 0;align-items:stretch;flex-wrap:wrap">${chip('Total',f0(tot),cl.length+' mês(es) fechado(s)')}${chip('Média/mês',f0(avg),'considerando todos os meses')}${chip('Maior',hi?f0(hi.v):'—',hi?mShort(hi.m):'','neg')}${chip('Menor',lo?f0(lo.v):'—',lo?mShort(lo.m):'','rec')}</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13.5px"><thead><tr><th style="font-size:11.5px;text-align:left;color:var(--ink2);text-transform:uppercase;letter-spacing:.05em;padding:6px 8px;border-bottom:1px solid var(--line)">Mês</th><th style="border-bottom:1px solid var(--line)"></th><th style="font-size:11.5px;text-align:right;color:var(--ink2);text-transform:uppercase;letter-spacing:.05em;padding:6px 8px;border-bottom:1px solid var(--line)">Gasto</th><th style="font-size:11.5px;text-align:right;color:var(--ink2);text-transform:uppercase;letter-spacing:.05em;padding:6px 8px;border-bottom:1px solid var(--line)">vs mês anterior</th><th style="border-bottom:1px solid var(--line)"></th></tr></thead><tbody>${body}</tbody>
    <tfoot><tr><td style="padding:10px 8px;font-weight:800">Total</td><td></td><td style="padding:10px 8px;text-align:right;font-weight:800;white-space:nowrap">${f2(tot)}</td><td colspan="2" style="padding:10px 8px;color:var(--ink2);font-size:12.5px">meses fechados${rowsD.some(r=>r.part&&r.v>0)?' (sem o mês em andamento)':''}</td></tr></tfoot></table></div>`;
  $('catMDlg').showModal();
}
function bindInsights(){
$('cmClose').onclick=()=>$('catMDlg').close();
$('catMDlg').addEventListener('close',()=>{const b=$('trendIns'),tr=selectedInsightCategory&&[...b.querySelectorAll('[data-cm]')].find(x=>x.querySelector('td').textContent.trim().endsWith(selectedInsightCategory));if(tr)markSel(b,tr);});
}

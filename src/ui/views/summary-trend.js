/**
 * ui/views/resumo-trend.js
 * Responsibility: Summary tab: monthly spending chart with curve, trend line and comparison tooltip.
 */
function renderTrend(){
  const sv=$('chTrend'),nowM=mOf(today());
  if(!S.tx.length){sv.innerHTML='';$('trendSum').innerHTML='<div class="empty">Lance despesas para ver a evolução.</div>';return;}
  const end=Math.max(mIdx(cur),mIdx(nowM)),ms=[];
  for(let k=end-11;k<=end;k++)ms.push(mKey(k));
  const vals=ms.map(m=>sum(txIn(m,'despesa').map(t=>t.value))+undetailedInMonth(m)),part=ms.map(m=>m===nowM);
  const ci=ms.map((m,k)=>k).filter(k=>!part[k]&&vals[k]>0&&mIdx(ms[k])<mIdx(nowM)),cv=ci.map(k=>vals[k]),n=cv.length;
  const avg=n?sum(cv)/n:0;
  let slope=0,icpt=avg,k0=0;
  if(n>=3){const xs=ci,mx=sum(xs)/n;let num=0,den=0;xs.forEach((x,i)=>{num+=(x-mx)*(cv[i]-avg);den+=(x-mx)**2;});slope=num/den;icpt=avg-slope*mx;}
  const rel=avg?slope/avg:0,verdict=n<3?null:rel>0.03?'alta':rel<-0.03?'queda':'estavel';
  const pc=x=>Math.abs(x*100).toFixed(1).replace('.',',')+'%';
  let dlt='Sem base',dcls='',dsub='Precisa de 2 meses fechados';
  if(n>=2){const a=cv[n-1],b=cv[n-2],d=b?(a-b)/b:0;dlt=(d>=0?'▲ +':'▼ −')+pc(d);dcls=d>0.001?'neg':d<-0.001?'pos':'';dsub=mShort(ms[ci[n-1]])+' '+f0(a)+' · '+mShort(ms[ci[n-2]])+' '+f0(b);}
  const vtxt={alta:'Em alta',queda:'Em queda',estavel:'Estável'}[verdict]||'Dados insuficientes';
  const vcls={alta:'neg',queda:'pos'}[verdict]||'';
  const vsub=verdict?(slope>=0?'+':'−')+f0(Math.abs(slope))+' por mês ('+(rel>=0?'+':'−')+pc(rel)+' ao mês)':'Aparece com 3 meses fechados';
  $('trendSum').innerHTML=
    kpi('','🧮','Média mensal',n?f0(avg):'—',n?n+(n>1?' meses fechados':' mês fechado'):'Sem meses fechados')+
    kpi('des','➖','Último mês fechado',`<span class="${dcls}">${dlt}</span>`,dsub)+
    kpi('','📈','Tendência',`<span class="${vcls}" style="${verdict?'':'font-size:18px;font-weight:600;color:var(--muted)'}">${vtxt}</span>`,vsub);
  const W=980,H=270,L=48,R=84,T=18,B=34,pw=W-L-R,ph=H-T-B,N=ms.length,br=css('--brand');
  const tEnd=n>=3?icpt+slope*ci[n-1]:0;
  const top=Math.max(...vals,tEnd,1);
  const step=top>20000?5000:top>8000?2000:top>3000?1000:top>1500?500:top>600?200:100;
  const ymax=Math.ceil(top*1.05/step)*step,y=v=>T+ph-v/ymax*ph,bw=pw/N,w=Math.min(bw*0.62,44);
  const short=v=>v>=1000?(v/1000).toFixed(1).replace('.',',').replace(',0','')+'k':String(Math.round(v));
  let g=`<defs><pattern id="hatch2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${br}" fill-opacity=".10"/><line x1="0" y1="0" x2="0" y2="7" stroke="${br}" stroke-opacity=".55" stroke-width="2.5"/></pattern></defs>`;
  for(let v=0;v<=ymax;v+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="${css('--line')}" ${v?'stroke-dasharray="2 5"':''}/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="${css('--muted')}">${v?short(v):'0'}</text>`;
  ms.forEach((m,k)=>{const x=L+k*bw+(bw-w)/2,v=vals[k],sel=m===cur;
    g+=`<g class="tb" data-tm="${m}" style="cursor:pointer"><rect x="${L+k*bw}" y="${T}" width="${bw}" height="${ph+B}" fill="transparent"/>`+
      (v>0?`<path d="${rr(x,y(v),w,y(0)-y(v),6)}" fill="${part[k]?'url(#hatch2)':br}" ${part[k]?`stroke="${br}" stroke-opacity=".6" stroke-width="1.3"`:`fill-opacity="${sel?.95:.3}"`}></path>`
        +(y(0)-y(v)>20?`<text x="${x+w/2}" y="${y(0)-7}" text-anchor="middle" font-size="11" font-weight="700" fill="${part[k]?br:sel?'#fff':css('--ink2')}" pointer-events="none">${short(v)}</text>`:`<text x="${x+w/2}" y="${y(v)-6}" text-anchor="middle" font-size="11" font-weight="700" fill="${css('--ink2')}" pointer-events="none">${short(v)}</text>`)
        :`<rect x="${x}" y="${y(0)-3}" width="${w}" height="3" rx="1.5" fill="${css('--line')}"/>`)+
      `<text x="${x+w/2}" y="${H-B+20}" text-anchor="middle" font-size="11.5" font-weight="${sel?800:400}" fill="${css(sel?'--ink':'--muted')}">${mShort(m)}</text></g>`;});
  {const cp=[];ms.forEach((m,k)=>{if(!part[k]&&vals[k]>0)cp.push([L+k*bw+bw/2,y(vals[k])]);});
   if(cp.length>=2){const d=smoothPath(cp);
    g+=`<path d="${d}" fill="none" stroke="${css('--card')}" stroke-width="6" stroke-linecap="round" pointer-events="none"/><path d="${d}" fill="none" stroke="${br}" stroke-width="2.5" stroke-linecap="round" pointer-events="none"/>`+cp.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="3.6" fill="${css('--card')}" stroke="${br}" stroke-width="2" pointer-events="none"/>`).join('');}}
  if(n>=3){const x0=L+ci[0]*bw+bw/2,x1=L+ci[n-1]*bw+bw/2,y0=y(icpt+slope*ci[0]),y1=y(tEnd),c=css('--warn');
    g+=`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${css('--card')}" stroke-width="6" stroke-linecap="round" pointer-events="none"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${c}" stroke-width="3" stroke-linecap="round" pointer-events="none"/>`+
      `<text x="${x1+14}" y="${y1+4}" font-size="12" font-weight="700" fill="${c}" pointer-events="none">${slope>=0?'▲':'▼'} ${pc(rel)}/mês</text>`;}
  else g+=`<text x="${L+8}" y="${T+6}" font-size="12" fill="${css('--muted')}">A linha de tendência aparece com 3 meses fechados com despesas.</text>`;
  $('trendDemo').innerHTML=n<3?'<button type="button" class="btn sm" id="trendDemoBtn">🧪 Gerar dados de teste (dez/2025 a out/2026)</button> <span class="help" style="margin:0">Para ver a linha de tendência. Depois remova em Ajustes → Dados.</span>':(S.tx.some(t=>t.demo)?'<span class="help" style="margin:0">🧪 Gráfico com dados de teste. Remova em Ajustes → Dados.</span>':'');
  if($('trendDemoBtn'))$('trendDemoBtn').onclick=generateDemoData;
  sv.setAttribute('viewBox',`0 0 ${W} ${H}`);sv.innerHTML=g;
  sv.querySelectorAll('.tb').forEach(el=>el.onclick=()=>{cur=el.dataset.tm;render();});
  renderInsights(ms,vals,ci);
  const tip=$('trendTip'),wrap=$('trendWrap');
  const tipHtml=k=>{const v=vals[k],pv=k>0?vals[k-1]:null;let cmp;
    if(pv===null)cmp='<span style="opacity:.7">Sem mês anterior para comparar</span>';
    else if(!(pv>0))cmp='<span style="opacity:.7">Sem gastos em '+mShort(ms[k-1])+' para comparar</span>';
    else if(!(v>0)&&!part[k])cmp='<span style="opacity:.7">Sem gastos neste mês</span>';
    else{const d=v-pv,pp=d/pv,up=d>0.004,dn=d<-0.004,col=up?'#ff8a80':dn?'#6ee7b7':'inherit';
      cmp=`<div style="font-weight:800;font-size:15px;color:${col}">${up?'▲ +':dn?'▼ −':''}${(Math.abs(pp)*100).toFixed(1).replace('.',',')}%</div><div style="color:${col}">${up||dn?'Gastou '+f2(Math.abs(d))+(up?' a mais':' a menos'):'Gasto igual ao mês anterior'}</div><div style="opacity:.7;font-size:12px">vs ${mShort(ms[k-1])}: ${f2(pv)}</div>`;}
    const cm=catMonth(ms[k]),cp=k>0?catMonth(ms[k-1]):{},tops=Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const topH=tops.length?'<div style="border-top:1px solid rgba(255,255,255,.2);margin-top:8px;padding-top:6px"><div style="opacity:.7;font-size:12px">Onde mais gastou</div>'+tops.map(([c,x])=>`<div style="display:flex;justify-content:space-between;gap:14px"><span>${icon('despesa',c)} ${esc(c)}</span><span><b>${f0(x)}</b> <span style="opacity:.65">${(x/v*100).toFixed(0)}%</span></span></div>`).join('')+'</div>':'';
    let chg='';if(k>0&&pv>0){const ds=[...new Set([...Object.keys(cm),...Object.keys(cp)])].map(c=>[c,(cm[c]||0)-(cp[c]||0)]).filter(z=>Math.abs(z[1])>=1).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,3);
      if(ds.length)chg='<div style="border-top:1px solid rgba(255,255,255,.2);margin-top:8px;padding-top:6px"><div style="opacity:.7;font-size:12px">O que mais mudou</div>'+ds.map(([c,x])=>`<div style="display:flex;justify-content:space-between;gap:14px"><span>${esc(c)}</span><b style="color:${x>0?'#ff8a80':'#6ee7b7'}">${x>0?'+':'−'}${f0(Math.abs(x))}</b></div>`).join('')+'</div>';}
    return `<div style="font-weight:700">${mLabel(ms[k])}${part[k]?' <span style="opacity:.7;font-weight:500">(em andamento)</span>':''}</div><div style="font-size:15px;margin:2px 0 6px">${f2(v)}</div>${cmp}${topH}${chg}`;};
  sv.querySelectorAll('.tb').forEach(el=>{
    el.onmousemove=e=>{const k=ms.indexOf(el.dataset.tm);tip.innerHTML=tipHtml(k);const bb=wrap.getBoundingClientRect();
      let x=e.clientX-bb.left+16;if(x>bb.width-tip.offsetWidth-8)x=e.clientX-bb.left-tip.offsetWidth-16;
      tip.style.left=Math.max(0,x)+'px';tip.style.top=Math.max(0,Math.min(e.clientY-bb.top-10,bb.height-tip.offsetHeight))+'px';tip.style.opacity=1;};
    el.onmouseleave=()=>tip.style.opacity=0;});
}

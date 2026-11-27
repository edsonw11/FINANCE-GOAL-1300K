/**
 * ui/views/summary-trend.js
 * Responsibility: Summary tab: monthly spending chart with curve, trend line and comparison tooltip.
 */
import { $, css, esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { f0, f2 } from '../../core/format.js';
import { mLabel, mShort } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { groupIcon } from '../../domain/category-groups.js';
import { groupMonth, spendingWindow } from '../../domain/spending.js';
import { linearTrend } from '../../domain/spending-stats.js';
import { ui } from '../ui-state.js';
import { render } from '../render.js';
import { chartWidth, rr, smoothPath } from '../charts/chart-utils.js';
import { kpi } from './kpi.js';
import { renderInsights } from './summary-insights.js';
import { generateDemoData } from './settings-demo.js';
export function renderTrend(){
  const sv=$('chTrend');
  if(!S.tx.length){sv.innerHTML='';$('trendSum').innerHTML=`<div class="empty">${t('sum.trend.empty')}</div>`;return;}
  const {ms,vals,part,ci}=spendingWindow(ui.cur),cv=ci.map(k=>vals[k]),n=cv.length;
  const tr=linearTrend(ci,cv),avg=tr.avg,slope=n>=3?tr.slope:0,icpt=n>=3?tr.intercept:avg;
  const rel=avg?slope/avg:0,verdict=n<3?null:rel>0.03?'alta':rel<-0.03?'queda':'estavel';
  const pc=x=>Math.abs(x*100).toFixed(1).replace('.',',')+'%';
  let dlt=t('sum.trend.noBase'),dcls='',dsub=t('sum.trend.needs2');
  if(n>=2){const a=cv[n-1],b=cv[n-2],d=b?(a-b)/b:0;dlt=(d>=0?'▲ +':'▼ −')+pc(d);dcls=d>0.001?'neg':d<-0.001?'pos':'';dsub=mShort(ms[ci[n-1]])+' '+f0(a)+' · '+mShort(ms[ci[n-2]])+' '+f0(b);}
  const vtxt=t({alta:'sum.trend.up',queda:'sum.trend.down',estavel:'sum.trend.stable'}[verdict]||'sum.trend.insufficient');
  const vcls={alta:'neg',queda:'pos'}[verdict]||'';
  const vsub=verdict?t('sum.trend.slopeSub',{value:(slope>=0?'+':'−')+f0(Math.abs(slope)),pct:(rel>=0?'+':'−')+pc(rel)}):t('sum.trend.needs3');
  $('trendSum').innerHTML=
    kpi('','🧮',t('sum.trend.avgMonthly'),n?f0(avg):'—',n?t('sum.trend.closedMonths',{count:n}):t('sum.trend.noClosed'),'',n?'avg':'')+
    kpi('des','➖',t('sum.trend.lastClosed'),`<span class="${dcls}">${dlt}</span>`,dsub,'',n>=2?'lastmonth':'')+
    kpi('','📈',t('sum.trend.trend'),`<span class="${vcls}${verdict?'':' trend-none'}">${vtxt}</span>`,vsub,'',n?'trend':'');
  const W=chartWidth(sv,980,240),narrow=W<640,H=narrow?230:270,L=narrow?38:48,R=narrow?(n>=3?58:10):84,T=18,B=34,pw=W-L-R,ph=H-T-B,N=ms.length,br=css('--brand');
  const tEnd=n>=3?icpt+slope*ci[n-1]:0;
  const top=Math.max(...vals,tEnd,1);
  const step=top>20000?5000:top>8000?2000:top>3000?1000:top>1500?500:top>600?200:100;
  const ymax=Math.ceil(top*(narrow?1.12:1.05)/step)*step,y=v=>T+ph-v/ymax*ph,bw=pw/N,w=Math.min(bw*0.62,44);
  const short=v=>v>=1000?(v/1000).toFixed(1).replace('.',',').replace(',0','')+'k':String(Math.round(v));
  let g=`<defs><pattern id="hatch2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${br}" fill-opacity=".10"/><line x1="0" y1="0" x2="0" y2="7" stroke="${br}" stroke-opacity=".55" stroke-width="2.5"/></pattern></defs>`;
  for(let v=0;v<=ymax;v+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="${css('--line')}" ${v?'stroke-dasharray="2 5"':''}/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="${css('--muted')}">${v?short(v):'0'}</text>`;
  ms.forEach((m,k)=>{const x=L+k*bw+(bw-w)/2,v=vals[k],sel=m===ui.cur;
    g+=`<g class="tb" data-tm="${m}"><rect x="${L+k*bw}" y="${T}" width="${bw}" height="${ph+B}" fill="transparent"/>`+
      (v>0?`<path d="${rr(x,y(v),w,y(0)-y(v),6)}" fill="${part[k]?'url(#hatch2)':br}" ${part[k]?`stroke="${br}" stroke-opacity=".6" stroke-width="1.3"`:`fill-opacity="${sel?.95:.3}"`}></path>`
        +(narrow?'':y(0)-y(v)>20?`<text x="${x+w/2}" y="${y(0)-7}" text-anchor="middle" font-size="11" font-weight="700" fill="${part[k]?br:sel?'#fff':css('--ink2')}" pointer-events="none">${short(v)}</text>`:`<text x="${x+w/2}" y="${y(v)-6}" text-anchor="middle" font-size="11" font-weight="700" fill="${css('--ink2')}" pointer-events="none">${short(v)}</text>`)
        :`<rect x="${x}" y="${y(0)-3}" width="${w}" height="3" rx="1.5" fill="${css('--line')}"/>`)+
      `<text x="${x+w/2}" y="${H-B+20}" text-anchor="middle" font-size="11.5" font-weight="${sel?800:400}" fill="${css(sel?'--ink':'--muted')}">${narrow?mShort(m).slice(0,3):mShort(m)}</text></g>`;});
  {const cp=[];ms.forEach((m,k)=>{if(!part[k]&&vals[k]>0)cp.push([L+k*bw+bw/2,y(vals[k])]);});
   if(cp.length>=2){const d=smoothPath(cp);
    g+=`<path d="${d}" fill="none" stroke="${css('--card')}" stroke-width="6" stroke-linecap="round" pointer-events="none"/><path d="${d}" fill="none" stroke="${br}" stroke-width="2.5" stroke-linecap="round" pointer-events="none"/>`+cp.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="3.6" fill="${css('--card')}" stroke="${br}" stroke-width="2" pointer-events="none"/>`).join('');}}
  if(n>=3){const x0=L+ci[0]*bw+bw/2,x1=L+ci[n-1]*bw+bw/2,y0=y(icpt+slope*ci[0]),y1=y(tEnd),c=css('--warn');
    g+=`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${css('--card')}" stroke-width="6" stroke-linecap="round" pointer-events="none"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${c}" stroke-width="3" stroke-linecap="round" pointer-events="none"/>`+
      `<text x="${x1+14}" y="${y1+4}" font-size="${narrow?10.5:12}" font-weight="700" fill="${c}" pointer-events="none">${narrow?`${slope>=0?'▲':'▼'} ${pc(rel)}`:t('sum.trend.lineLabel',{arrow:slope>=0?'▲':'▼',pct:pc(rel)})}</text>`;}
  else if(!narrow)g+=`<text x="${L+8}" y="${T+6}" font-size="12" fill="${css('--muted')}">${t('sum.trend.lineHint')}</text>`;
  $('trendDemo').innerHTML=n<3?`<button type="button" class="btn sm" id="trendDemoBtn">${t('sum.trend.demoBtn')}</button> <span class="help flush">${t('sum.trend.demoHint')}</span>`:(S.tx.some(x=>x.demo)?`<span class="help flush">${t('sum.trend.demoNote')}</span>`:'');
  if($('trendDemoBtn'))$('trendDemoBtn').onclick=generateDemoData;
  sv.setAttribute('viewBox',`0 0 ${W} ${H}`);sv.innerHTML=g;
  sv.querySelectorAll('.tb').forEach(el=>el.onclick=()=>{ui.cur=el.dataset.tm;render();});
  renderInsights(ms,vals,ci);
  const tip=$('trendTip'),wrap=$('trendWrap');
  const tipHtml=k=>{const v=vals[k],pv=k>0?vals[k-1]:null;let cmp;
    if(pv===null)cmp=`<span class="tt-dim">${t('sum.trend.noPrevious')}</span>`;
    else if(!(pv>0))cmp=`<span class="tt-dim">${t('sum.trend.noSpendIn',{month:mShort(ms[k-1])})}</span>`;
    else if(!(v>0)&&!part[k])cmp=`<span class="tt-dim">${t('sum.trend.noSpendThis')}</span>`;
    else{const d=v-pv,pp=d/pv,up=d>0.004,dn=d<-0.004,tone=up?'tt-up':dn?'tt-dn':'';
      cmp=`<div class="tt-pct ${tone}">${up?'▲ +':dn?'▼ −':''}${(Math.abs(pp)*100).toFixed(1).replace('.',',')}%</div><div class="${tone}">${up||dn?t(up?'sum.trend.spentMore':'sum.trend.spentLess',{value:f2(Math.abs(d))}):t('sum.trend.spentSame')}</div><div class="tt-dim tt-sm">${t('sum.trend.vsMonth',{month:mShort(ms[k-1]),value:f2(pv)})}</div>`;}
    const cm=groupMonth(ms[k]),cp=k>0?groupMonth(ms[k-1]):{},tops=Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const topH=tops.length?'<div class="tt-sec"><div class="tt-dim tt-sm">'+t('sum.trend.whereMost')+'</div>'+tops.map(([c,x])=>`<div class="tt-row"><span>${groupIcon(c)} ${esc(displayName(c))}</span><span><b>${f0(x)}</b> <span class="tt-dim2">${(x/v*100).toFixed(0)}%</span></span></div>`).join('')+'</div>':'';
    let chg='';if(k>0&&pv>0){const ds=[...new Set([...Object.keys(cm),...Object.keys(cp)])].map(c=>[c,(cm[c]||0)-(cp[c]||0)]).filter(z=>Math.abs(z[1])>=1).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,3);
      if(ds.length)chg='<div class="tt-sec"><div class="tt-dim tt-sm">'+t('sum.trend.whatChanged')+'</div>'+ds.map(([c,x])=>`<div class="tt-row"><span>${esc(displayName(c))}</span><b class="${x>0?'tt-up':'tt-dn'}">${x>0?'+':'−'}${f0(Math.abs(x))}</b></div>`).join('')+'</div>';}
    return `<div class="tt-m">${mLabel(ms[k])}${part[k]?` ${t('sum.trend.inProgress')}`:''}</div><div class="tt-v">${f2(v)}</div>${cmp}${topH}${chg}`;};
  // touch screens have no hover: the selected month (tap a bar) is explained below the chart
  const selK=ms.indexOf(ui.cur),touch=narrow||matchMedia('(pointer:coarse)').matches;
  $('trendSel').innerHTML=touch&&selK>=0?`<div class="tsel">${tipHtml(selK)}<button type="button" class="btn sm" data-kpi="expenses" data-m="${ui.cur}">${t('sum.trend.seeExpenses',{month:mShort(ui.cur)})}</button></div>`:'';
  if(touch)return;
  sv.querySelectorAll('.tb').forEach(el=>{
    el.onmousemove=e=>{const k=ms.indexOf(el.dataset.tm);tip.innerHTML=tipHtml(k);const bb=wrap.getBoundingClientRect();
      let x=e.clientX-bb.left+16;if(x>bb.width-tip.offsetWidth-8)x=e.clientX-bb.left-tip.offsetWidth-16;
      tip.style.left=Math.max(0,x)+'px';tip.style.top=Math.max(0,Math.min(e.clientY-bb.top-10,bb.height-tip.offsetHeight))+'px';tip.style.opacity=1;};
    el.onmouseleave=()=>tip.style.opacity=0;});
}

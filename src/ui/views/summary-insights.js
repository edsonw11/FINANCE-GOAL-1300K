/**
 * ui/views/summary-insights.js
 * Responsibility: Summary tab: spending analysis (KPIs, reading of the data, per-group table).
 * One render helper per block; the look is in styles/08-screens.css.
 */
import { $, esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { f0 } from '../../core/format.js';
import { mShort } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { groupIcon } from '../../domain/category-groups.js';
import { groupMonth } from '../../domain/spending.js';
import { categoryStats, linearTrend } from '../../domain/spending-stats.js';
import { ui } from '../ui-state.js';
import { openGroup } from './category-sheet.js';
// the highlighted row (look in styles/08-screens.css)
function markSel(box,tr){box.querySelectorAll('[data-cm]').forEach(x=>x.classList.toggle('rowsel',x===tr));}
const pctAbs=x=>Math.abs(x*100).toFixed(0)+'%',pct1=x=>Math.abs(x*100).toFixed(1).replace('.',',')+'%';
// getters: the text follows the active language at the moment it is read
const NOTE_LABEL={get info(){return t('sum.insights.noteInfo');},get warn(){return t('sum.insights.noteWarn');},get good(){return t('sum.insights.noteGood');}};
const KIND_CLASS={Fixo:'fixed','Variável':'variable',Pontual:'occasional'};
const KIND_KEY={Fixo:'sum.insights.kindFixed','Variável':'sum.insights.kindVariable',Pontual:'sum.insights.kindOccasional'};
// ---- blocks of the analysis (each returns HTML)
function tile(lab,val,sub,tone,key){
  return `<div class="ins-tile tap" data-kpi="${key}" role="button" tabindex="0" aria-label="${t('sum.kpi.viewDetails',{label:lab})}"><span class="kpi-go" aria-hidden="true">›</span><div class="ins-k">${lab}</div><div class="ins-v${tone?' tone-'+tone:''}">${val}</div><div class="ins-s">${sub}</div></div>`;
}
// the monthly average is not repeated here: it is on the Summary trend card
function tilesBlock(a){
  return [
    tile(t('sum.spending.fixedTitle'),f0(a.fixed),t('sum.insights.fixedSub',{percent:pctAbs(a.fixed/(a.fixed+a.vari+a.pont||1)),variable:f0(a.vari)}),'','fixed'),
    tile(t('sum.insights.concentration'),pctAbs(a.top3),t('sum.insights.top3Sub',{names:a.st.slice(0,3).map(z=>esc(displayName(z.c).split(' ')[0])).join(', ')}),'','top3'),
    tile(t('sum.insights.savingsPotential'),t('sum.insights.perMonth',{value:f0(a.save)}),t('sum.insights.savingsSub',{year:f0(a.save*12)}),'rec','variable')].join('');
}
// "reading of the data": short findings, each with a tone (info / warn / good)
function readingNotes(a){
  const {st,N,avg,slope,proj,last,cl,pont}=a,L=[];
  L.push({t:'info',h:t('sum.insights.topGroup'),x:t('sum.insights.topGroupText',{name:esc(displayName(st[0].c)),percent:pctAbs(st[0].share),total:f0(st[0].t),mean:f0(st[0].mean)})});
  if(N>=3){const rel=avg?slope/avg:0;
    L.push(Math.abs(rel)<0.03?{t:'good',h:t('sum.insights.stable'),x:proj?t('sum.insights.stableProj',{value:f0(Math.abs(slope)),proj:f0(proj)}):t('sum.insights.stableText',{value:f0(Math.abs(slope))})}
      :{t:rel>0?'warn':'good',h:rel>0?t('sum.insights.rising'):t('sum.insights.falling'),x:t('sum.insights.trendText',{value:(slope>0?'+':'−')+f0(Math.abs(slope)),monthly:pct1(rel),yearly:pct1(rel*12),proj:f0(proj)})});}
  const mv=st.filter(z=>z.d!==null&&z.kind!=='Pontual'&&Math.abs(z.d)>=1),up=mv.filter(z=>z.d>0).sort((x,y)=>y.d-x.d)[0],dn=mv.filter(z=>z.d<0).sort((x,y)=>x.d-y.d)[0];
  if(up)L.push({t:'warn',h:t('sum.insights.biggestRise',{month:mShort(last.m)}),x:up.p!==null?t('sum.insights.riseTextPct',{name:esc(displayName(up.c)),cur:f0(up.cur),diff:f0(up.d),pct:pctAbs(up.p)}):t('sum.insights.riseText',{name:esc(displayName(up.c)),cur:f0(up.cur),diff:f0(up.d)})});
  if(dn)L.push({t:'good',h:t('sum.insights.biggestDrop',{month:mShort(last.m)}),x:dn.p!==null?t('sum.insights.dropTextPct',{name:esc(displayName(dn.c)),cur:f0(dn.cur),diff:f0(Math.abs(dn.d)),pct:pctAbs(dn.p)}):t('sum.insights.dropText',{name:esc(displayName(dn.c)),cur:f0(dn.cur),diff:f0(Math.abs(dn.d))})});
  if(N>=3){const hi=cl.reduce((x,y)=>y.v>x.v?y:x),drv=st.map(z=>[z.c,(hi.c[z.c]||0)-z.mean]).sort((x,y)=>y[1]-x[1])[0];
    L.push({t:hi.v>avg*1.1?'warn':'info',h:t('sum.insights.peak',{month:mShort(hi.m)}),x:drv&&drv[1]>1?t('sum.insights.peakTextCause',{value:f0(hi.v),pct:pctAbs((hi.v-avg)/avg),name:esc(displayName(drv[0])),extra:f0(drv[1])}):t('sum.insights.peakText',{value:f0(hi.v),pct:pctAbs((hi.v-avg)/avg)})});}
  if(pont>0)L.push({t:'info',h:t('sum.insights.occasional'),x:t('sum.insights.occasionalText',{value:f0(pont),names:st.filter(z=>z.kind==='Pontual').map(z=>esc(displayName(z.c))).join(', ')})});
  return L.map(i=>`<div class="ins-note ${i.t}"><div class="ins-note-h">${t('sum.insights.noteHead',{label:NOTE_LABEL[i.t],heading:i.h})}</div><div class="ins-note-x">${i.x}</div></div>`).join('');
}
const change=z=>z.kind==='Pontual'&&z.cur===0?`<span class="mut">${t('sum.insights.noSpend')}</span>`:z.d===null||Math.abs(z.d)<1?`<span class="mut">${t('sum.insights.steady')}</span>`
  :`<span class="${z.d>0?'neg':'pos'}">${z.d>0?'▲ +':'▼ −'}${f0(Math.abs(z.d))}${z.p!==null&&z.kind!=='Pontual'?' <span class="ins-pct">('+pctAbs(z.p)+')</span>':''}</span>`;
function groupTable(a){
  const {st,last,tot,avg,dLast}=a,mx=st[0].t;
  const rows=st.map((z,ix)=>`<tr class="rowclick${z.c===ui.selectedInsightCategory?' rowsel':''}" data-cm="${ix}"><td class="nw">${groupIcon(z.c)} ${esc(displayName(z.c))}</td><td class="hide-sm"><span class="kind-pill ${KIND_CLASS[z.kind]}">${t(KIND_KEY[z.kind])}</span></td><td class="hide-sm ins-share"><div class="ins-share-row"><div class="ins-bar"><i style="width:${z.t/mx*100}%"></i></div><span class="mut">${pctAbs(z.share)}</span></div></td><td class="r"><b>${f0(z.t)}</b></td><td class="hide-sm r nw">${f0(z.mean)}</td><td class="r nw">${change(z)}</td></tr>`).join('');
  return `<div class="scroll"><table class="ins-table"><thead><tr><th>${t('sum.insights.thGroup')}</th><th class="hide-sm">${t('sum.insights.thProfile')}</th><th class="hide-sm">${t('sum.insights.thShare')}</th><th class="r">${t('sum.list.total')}</th><th class="hide-sm r">${t('sum.insights.thAvg')}</th><th class="r">${t('sum.insights.thVsAvg',{month:mShort(last.m)})}</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td class="b8">${t('sum.list.total')}</td><td class="hide-sm"></td><td class="hide-sm"><span class="mut">100%</span></td><td class="r b8">${f0(tot)}</td><td class="hide-sm r b8 nw">${f0(avg)}</td><td class="r nw">${dLast===null?'':`<span class="${dLast>0?'neg':'pos'} b8">${dLast>=0?'▲ +':'▼ −'}${f0(Math.abs(dLast))}</span>`}</td></tr></tfoot></table></div>`;
}
// numbers used by every block
function analysisOf(ms,vals,ci){
  const cl=ci.map(k=>({m:ms[k],v:vals[k],c:groupMonth(ms[k])})),N=cl.length,last=cl[N-1];
  const stats=categoryStats(cl),prevAvg=N>=2?sumMoney(cl.slice(Math.max(0,N-4),N-1).map(x=>x.v))/Math.min(3,N-1):null;
  const tr=linearTrend(cl.map((x,i)=>i),cl.map(x=>x.v));
  return {cl,N,last,st:stats.list,tot:stats.total,avg:stats.average,fixed:stats.fixed,vari:stats.variable,pont:stats.occasional,top3:stats.top3Share,
    save:stats.variable*0.10,prevAvg,dLast:prevAvg===null?null:last.v-prevAvg,slope:N>=3?tr.slope:0,proj:N>=3?tr.intercept+tr.slope*N:null};
}
export function renderInsights(ms,vals,ci){
  const box=$('trendIns');
  if(ci.length<1){box.innerHTML='';return;}
  const a=analysisOf(ms,vals,ci);
  box.innerHTML=`<div class="ins-head"><div class="ins-title">${t('sum.insights.title')}</div><div class="help flush">${t('sum.insights.summary',{count:a.N,from:mShort(a.cl[0].m),to:mShort(a.last.m),total:f0(a.tot)})}</div></div>
    <div class="grid ins-tiles">${tilesBlock(a)}</div>
    <div class="sec-label">${t('sum.insights.reading')}</div>
    <div class="grid ins-read">${readingNotes(a)}</div>
    <div class="ins-groups">
      <div><div class="sec-label sm">${t('sum.insights.byGroup')}</div>${groupTable(a)}
      <div class="help ins-help">${t('sum.insights.help')}</div></div>
    </div>`;
  box.querySelectorAll('[data-cm]').forEach(tr=>{tr.tabIndex=0;tr.setAttribute('role','button');
    tr.onclick=()=>{markSel(box,tr);openGroup(a.st[+tr.dataset.cm].c);};});
}
// keeps the highlighted category in the table after the detail closes
export function bindInsights(){
  $('sheet').addEventListener('close',()=>{const b=$('trendIns'),tr=ui.selectedInsightCategory&&[...b.querySelectorAll('[data-cm]')].find(x=>x.querySelector('td').textContent.trim().endsWith(ui.selectedInsightCategory));if(tr)markSel(b,tr);});
}

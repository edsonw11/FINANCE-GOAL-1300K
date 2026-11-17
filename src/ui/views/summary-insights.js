/**
 * ui/views/summary-insights.js
 * Responsibility: Summary tab: spending analysis (KPIs, reading of the data, per-group table).
 * One render helper per block; the look is in styles/08-screens.css.
 */
import { $, esc } from '../../core/dom.js';
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
const NOTE_LABEL={info:'Informação',warn:'Atenção',good:'Positivo'};
const KIND_CLASS={Fixo:'fixed','Variável':'variable',Pontual:'occasional'};
// ---- blocks of the analysis (each returns HTML)
function tile(lab,val,sub,tone,key){
  return `<div class="ins-tile tap" data-kpi="${key}" role="button" tabindex="0" aria-label="${lab}: ver detalhes"><span class="kpi-go" aria-hidden="true">›</span><div class="ins-k">${lab}</div><div class="ins-v${tone?' tone-'+tone:''}">${val}</div><div class="ins-s">${sub}</div></div>`;
}
// the monthly average is not repeated here: it is on the Summary trend card
function tilesBlock(a){
  return [
    tile('Gastos fixos',f0(a.fixed),`${pctAbs(a.fixed/(a.fixed+a.vari+a.pont||1))} da média · variáveis ${f0(a.vari)}`,'','fixed'),
    tile('Concentração',pctAbs(a.top3),'nos 3 maiores grupos: '+a.st.slice(0,3).map(z=>esc(z.c.split(' ')[0])).join(', '),'','top3'),
    tile('Potencial de economia',f0(a.save)+'/mês',`cortando 10% do variável · ${f0(a.save*12)} por ano`,'rec','variable')].join('');
}
// "reading of the data": short findings, each with a tone (info / warn / good)
function readingNotes(a){
  const {st,N,avg,slope,proj,last,cl,pont}=a,L=[];
  L.push({t:'info',h:'Maior grupo',x:`<b>${esc(st[0].c)}</b> concentra ${pctAbs(st[0].share)} do total (${f0(st[0].t)}, média de ${f0(st[0].mean)} por mês).`});
  if(N>=3){const rel=avg?slope/avg:0;
    L.push(Math.abs(rel)<0.03?{t:'good',h:'Tendência estável',x:`Os gastos variam ${f0(Math.abs(slope))} por mês, abaixo de 3% da média. ${proj?'Projeção para o próximo mês: <b>'+f0(proj)+'</b>.':''}`}
      :{t:rel>0?'warn':'good',h:rel>0?'Gastos em alta':'Gastos em queda',x:`Tendência de <b>${slope>0?'+':'−'}${f0(Math.abs(slope))} por mês</b> (${pct1(rel)} ao mês, ${pct1(rel*12)} ao ano). Projeção para o próximo mês: <b>${f0(proj)}</b>.`});}
  const mv=st.filter(z=>z.d!==null&&z.kind!=='Pontual'&&Math.abs(z.d)>=1),up=mv.filter(z=>z.d>0).sort((x,y)=>y.d-x.d)[0],dn=mv.filter(z=>z.d<0).sort((x,y)=>x.d-y.d)[0];
  if(up)L.push({t:'warn',h:'Maior alta em '+mShort(last.m),x:`<b>${esc(up.c)}</b>: ${f0(up.cur)}, ${f0(up.d)} acima da média dos meses anteriores${up.p!==null?' (+'+pctAbs(up.p)+')':''}.`});
  if(dn)L.push({t:'good',h:'Maior queda em '+mShort(last.m),x:`<b>${esc(dn.c)}</b>: ${f0(dn.cur)}, ${f0(Math.abs(dn.d))} abaixo da média dos meses anteriores${dn.p!==null?' (−'+pctAbs(dn.p)+')':''}.`});
  if(N>=3){const hi=cl.reduce((x,y)=>y.v>x.v?y:x),drv=st.map(z=>[z.c,(hi.c[z.c]||0)-z.mean]).sort((x,y)=>y[1]-x[1])[0];
    L.push({t:hi.v>avg*1.1?'warn':'info',h:'Pico: '+mShort(hi.m),x:`${f0(hi.v)}, ${pctAbs((hi.v-avg)/avg)} acima da média${drv&&drv[1]>1?`. Principal causa: <b>${esc(drv[0])}</b> (+${f0(drv[1])} sobre o normal)`:''}.`});}
  if(pont>0)L.push({t:'info',h:'Gastos pontuais',x:`Grupos que aparecem em poucos meses somam ${f0(pont)} por mês em média (${st.filter(z=>z.kind==='Pontual').map(z=>esc(z.c)).join(', ')}). Vale reservar um valor mensal para eles.`});
  return L.map(i=>`<div class="ins-note ${i.t}"><div class="ins-note-h">${NOTE_LABEL[i.t]} · ${i.h}</div><div class="ins-note-x">${i.x}</div></div>`).join('');
}
const change=z=>z.kind==='Pontual'&&z.cur===0?'<span class="mut">sem gasto</span>':z.d===null||Math.abs(z.d)<1?'<span class="mut">estável</span>'
  :`<span class="${z.d>0?'neg':'pos'}">${z.d>0?'▲ +':'▼ −'}${f0(Math.abs(z.d))}${z.p!==null&&z.kind!=='Pontual'?' <span class="ins-pct">('+pctAbs(z.p)+')</span>':''}</span>`;
function groupTable(a){
  const {st,last,tot,avg,dLast}=a,mx=st[0].t;
  const rows=st.map((z,ix)=>`<tr class="rowclick${z.c===ui.selectedInsightCategory?' rowsel':''}" data-cm="${ix}"><td class="nw">${groupIcon(z.c)} ${esc(z.c)}</td><td class="hide-sm"><span class="kind-pill ${KIND_CLASS[z.kind]}">${z.kind}</span></td><td class="hide-sm ins-share"><div class="ins-share-row"><div class="ins-bar"><i style="width:${z.t/mx*100}%"></i></div><span class="mut">${pctAbs(z.share)}</span></div></td><td class="r"><b>${f0(z.t)}</b></td><td class="hide-sm r nw">${f0(z.mean)}</td><td class="r nw">${change(z)}</td></tr>`).join('');
  return `<div class="scroll"><table class="ins-table"><thead><tr><th>Grupo</th><th class="hide-sm">Perfil</th><th class="hide-sm">Participação</th><th class="r">Total</th><th class="hide-sm r">Média/mês</th><th class="r">${mShort(last.m)} vs média</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td class="b8">Total</td><td class="hide-sm"></td><td class="hide-sm"><span class="mut">100%</span></td><td class="r b8">${f0(tot)}</td><td class="hide-sm r b8 nw">${f0(avg)}</td><td class="r nw">${dLast===null?'':`<span class="${dLast>0?'neg':'pos'} b8">${dLast>=0?'▲ +':'▼ −'}${f0(Math.abs(dLast))}</span>`}</td></tr></tfoot></table></div>`;
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
  box.innerHTML=`<div class="ins-head"><div class="ins-title">Análise dos gastos</div><div class="help flush">${a.N} mês(es) fechado(s) · ${mShort(a.cl[0].m)} a ${mShort(a.last.m)} · total ${f0(a.tot)}</div></div>
    <div class="grid ins-tiles">${tilesBlock(a)}</div>
    <div class="sec-label">Leitura dos dados</div>
    <div class="grid ins-read">${readingNotes(a)}</div>
    <div class="ins-groups">
      <div><div class="sec-label sm">Por grupo</div>${groupTable(a)}
      <div class="help ins-help">Toque num grupo para ver o histórico mês a mês, a divisão por categoria e os lançamentos. Os grupos somam as categorias (ex.: Moradia = condomínio + luz + água + gás) e podem ser ajustados na aba Categorias. <b>Fixo</b>: valor quase igual todo mês. <b>Variável</b>: oscila. <b>Pontual</b>: aparece em menos da metade dos meses. A comparação usa a média dos até 3 meses anteriores.</div></div>
    </div>`;
  box.querySelectorAll('[data-cm]').forEach(tr=>{tr.tabIndex=0;tr.setAttribute('role','button');
    tr.onclick=()=>{markSel(box,tr);openGroup(a.st[+tr.dataset.cm].c);};});
}
// keeps the highlighted category in the table after the detail closes
export function bindInsights(){
  $('sheet').addEventListener('close',()=>{const b=$('trendIns'),tr=ui.selectedInsightCategory&&[...b.querySelectorAll('[data-cm]')].find(x=>x.querySelector('td').textContent.trim().endsWith(ui.selectedInsightCategory));if(tr)markSel(b,tr);});
}

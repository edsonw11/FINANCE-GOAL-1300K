/**
 * ui/views/goal.js
 * Responsibility: Goal tab: progress, deadline and contribution pace.
 */
import { decimalSeparator } from '../../core/locale-format.js';
import { $, css } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f0, pc, sum } from '../../core/format.js';
import { mIdx, mKey, mShort, today } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { totalGross } from '../../domain/accounts.js';
import { project, realSeries } from '../../domain/investments.js';
import { chartMonths, projectionPlan } from '../../domain/goal-projection.js';
import { drawTower } from '../charts/tower-chart.js';
import { kpi } from './kpi.js';
import { renderProj } from './projection.js';
// an annual rate above this is not shown: a single month does not say anything reliable about a year
const MAX_SHOWN_ANNUAL=1;
export function renderMeta(){
  const real=realSeries(),last=real[real.length-1],{hit}=project(real),goal=S.goal;
  const prog=Math.min(last.t/goal,1);
  const ets=hit===0?t('sum.goal.reachedBang'):(hit===null?t('sum.goal.moreThan5y'):t('sum.goal.months',{count:hit}));
  const etaN=hit>0?t('sum.goal.eta',{month:mShort(mKey(mIdx(last.m)+hit)),value:f0(S.planned)}):'';
  const gain=sum(real.slice(1).map(r=>r.y||0));
  $('kMeta').innerHTML=
    `<div class="card hero tap" data-kpi="networth" role="button" tabindex="0" aria-label="${t('sum.goal.heroAria')}"><span class="kpi-go" aria-hidden="true">›</span><div class="ring"><svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="56" fill="none" stroke="${css('--soft')}" stroke-width="12"/><circle cx="66" cy="66" r="56" fill="none" stroke="${css('--brand')}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(prog*351.86).toFixed(1)} 351.86" transform="rotate(-90 66 66)"/></svg><div class="pct">${Math.round(prog*100)}%</div></div><div><div class="k2">${t('sum.goal.netWorthToday',{chip:paceChip(real)})}</div><div class="big">${f0(last.t)}</div><div class="n">${last.t>=goal?t('sum.goal.reached'):t('sum.goal.remaining',{missing:f0(goal-last.t),goal:f0(goal)})}</div><div class="n mt-2">${(()=>{const tg=totalGross(today());return t('sum.goal.gross',{gross:(tg.ok?'':'≈ ')+f0(tg.g),tax:f0(tg.g-last.t)});})()}</div></div></div>`+
    kpi('','⏱️',t('sum.goal.forecast'),ets,etaN||'','','eta')+
    kpi('','📈',t('sum.goal.realYield'),real.length>1&&real.some(r=>r.y!==null)?(gain>=0?'+':'')+f0(gain):'—',t('sum.goal.realYieldSub'),'','yield');
  drawTower(real,projectionPlan(last,chartMonths(hit)).rows);renderProj(real,hit);
  const ylast=[...real].reverse().find(r=>r.y!==null);
  if(ylast){const mo=ylast.y/ylast.prev,ann=Math.pow(1+mo,12)-1;
    const above=ann>=S.rate/100,withAnnual=ann<=MAX_SHOWN_ANNUAL;
    $('paceMsg').innerHTML=t(above?(withAnnual?'sum.goal.paceAboveAnnual':'sum.goal.paceAbove'):(withAnnual?'sum.goal.paceBelowAnnual':'sum.goal.paceBelow'),{month:mShort(ylast.m),value:f0(ylast.y),monthly:pc(mo),annual:pc(ann),rate:String(S.rate).replace('.',decimalSeparator())});
  } else $('paceMsg').textContent=t('sum.goal.paceHint');
}
function paceChip(real){
  const y=[...real].reverse().find(r=>r.y!==null);
  if(!y)return `<span class="status nd">${t('sum.goal.chipNone')}</span>`;
  const ann=Math.pow(1+y.y/y.prev,12)-1;
  return ann>=S.rate/100?`<span class="status ok">${t('sum.goal.chipOk')}</span>`:`<span class="status warn">${t('sum.goal.chipLow')}</span>`;
}

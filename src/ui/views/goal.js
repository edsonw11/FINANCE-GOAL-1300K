/**
 * ui/views/goal.js
 * Responsibility: Goal tab: progress, deadline and contribution pace.
 */
import { $, css } from '../../core/dom.js';
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
  const ets=hit===0?'🎉 Meta atingida!':(hit===null?'mais de 5 anos':hit+(hit===1?' mês':' meses'));
  const etaN=hit>0?`Previsto para ${mShort(mKey(mIdx(last.m)+hit))} · aporte de ${f0(S.planned)}/mês`:'';
  const gain=sum(real.slice(1).map(r=>r.y||0));
  $('kMeta').innerHTML=
    `<div class="card hero tap" data-kpi="networth" role="button" tabindex="0" aria-label="Patrimônio líquido: ver contas"><span class="kpi-go" aria-hidden="true">›</span><div class="ring"><svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="56" fill="none" stroke="${css('--soft')}" stroke-width="12"/><circle cx="66" cy="66" r="56" fill="none" stroke="${css('--brand')}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(prog*351.86).toFixed(1)} 351.86" transform="rotate(-90 66 66)"/></svg><div class="pct">${Math.round(prog*100)}%</div></div><div><div class="k2">Patrimônio líquido hoje ${paceChip(real)}</div><div class="big">${f0(last.t)}</div><div class="n">${last.t>=goal?'🎉 Meta atingida':'Faltam <b>'+f0(goal-last.t)+'</b> para '+f0(goal)}</div><div class="n mt-2">${(()=>{const tg=totalGross(today());return 'Bruto nos apps: <b>'+(tg.ok?'':'≈ ')+f0(tg.g)+'</b> · IR embutido: '+f0(tg.g-last.t);})()}</div></div></div>`+
    kpi('','⏱️','Previsão para a meta',ets,etaN||'','','eta')+
    kpi('','📈','Rendimento real registrado',real.length>1&&real.some(r=>r.y!==null)?(gain>=0?'+':'')+f0(gain):'—','Soma dos meses com saldo atualizado','','yield');
  drawTower(real,projectionPlan(last,chartMonths(hit)).rows);renderProj(real,hit);
  const ylast=[...real].reverse().find(r=>r.y!==null);
  if(ylast){const mo=ylast.y/ylast.prev,ann=Math.pow(1+mo,12)-1;
    $('paceMsg').innerHTML=`📊 Em ${mShort(ylast.m)} o rendimento real foi ${f0(ylast.y)} (${pc(mo)} no mês${ann<=MAX_SHOWN_ANNUAL?', ~'+pc(ann)+' ao ano':''}), <b class="${ann>=S.rate/100?'pos':'neg'}">${ann>=S.rate/100?'acima':'abaixo'}</b> da premissa de ${String(S.rate).replace('.',',')}% a.a.`;
  } else $('paceMsg').textContent='ℹ️ Em Investimentos, atualize os saldos no fim do mês para comparar o rendimento real com a projeção.';
}
function paceChip(real){
  const y=[...real].reverse().find(r=>r.y!==null);
  if(!y)return '<span class="status nd">Sem rendimento medido</span>';
  const ann=Math.pow(1+y.y/y.prev,12)-1;
  return ann>=S.rate/100?'<span class="status ok">No ritmo ou acima</span>':'<span class="status warn">Abaixo do esperado</span>';
}

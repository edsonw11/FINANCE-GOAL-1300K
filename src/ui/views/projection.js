/**
 * ui/views/projection.js
 * Responsibility: the month by month projection table (collapsed under the Patrimônio chart).
 * The numbers come from domain/goal-projection.js, the same plan the chart draws.
 */
import { $ } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f0, pc } from '../../core/format.js';
import { mShort } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { lowerRate, projectionPlan, tableMonths } from '../../domain/goal-projection.js';
const rateText=v=>String(v).replace('.',',');
export function renderProj(real,hit){
  const last=real[real.length-1],goal=S.goal,ap=S.planned,plan=projectionPlan(last,tableMonths(hit));
  const rows=`<tr><th>${t('sum.common.month')}</th><th>${t('sum.proj.startBalance')}</th><th>${t('sum.proj.interest')}</th><th>${t('sum.proj.contribution')}</th><th>${t('sum.proj.endBalance')}</th><th>${t('sum.proj.pctGoal')}</th><th>${t('sum.proj.missing')}</th><th title="${t('sum.proj.lowTitle')}">${t('sum.proj.lowRate')}</th></tr>`+
    `<tr><td><b>${t('sum.proj.today')}</b></td><td>—</td><td>—</td><td>—</td><td><b>${f0(last.t)}</b></td><td>${pc(Math.min(last.t/goal,1))}</td><td>${last.t>=goal?'✅':f0(goal-last.t)}</td><td class="mut">${f0(last.t)}</td></tr>`+
    plan.rows.map(r=>`<tr${r.first?' class="row-hit"':''}><td>${mShort(r.m)}${r.first?' ✅':''}</td><td>${f0(r.start)}</td><td class="pos">+ ${f0(r.interest)}</td><td>${ap?'+ '+f0(ap):'—'}</td><td><b>${f0(r.end)}</b></td><td>${pc(Math.min(r.end/goal,1))}</td><td>${r.reached?t('sum.proj.reached'):f0(goal-r.end)}</td><td class="mut">${f0(r.low)}${r.low>=goal?' ✅':''}</td></tr>`).join('');
  $('projTbl').innerHTML=rows;
  $('projSum').textContent=t('sum.proj.summary',{rows:plan.rows.length+1});
  $('projHelp').innerHTML=t('sum.proj.help',{rate:rateText(S.rate),monthly:pc(plan.rate),contribution:f0(ap),lowRate:rateText(lowerRate())});
}

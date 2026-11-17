/**
 * ui/views/projection.js
 * Responsibility: the month by month projection table (collapsed under the Patrimônio chart).
 * The numbers come from domain/goal-projection.js, the same plan the chart draws.
 */
import { $ } from '../../core/dom.js';
import { f0, pc } from '../../core/format.js';
import { mShort } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { lowerRate, projectionPlan, tableMonths } from '../../domain/goal-projection.js';
const rateText=v=>String(v).replace('.',',');
export function renderProj(real,hit){
  const last=real[real.length-1],goal=S.goal,ap=S.planned,plan=projectionPlan(last,tableMonths(hit));
  const rows=`<tr><th>Mês</th><th>Saldo inicial</th><th>Juros do mês</th><th>Aporte</th><th>Saldo final</th><th>% da meta</th><th>Falta p/ meta</th><th title="Mesmo plano, mas com a taxa 2 pontos percentuais menor">Se juros caírem</th></tr>`+
    `<tr><td><b>Hoje</b></td><td>—</td><td>—</td><td>—</td><td><b>${f0(last.t)}</b></td><td>${pc(Math.min(last.t/goal,1))}</td><td>${last.t>=goal?'✅':f0(goal-last.t)}</td><td class="mut">${f0(last.t)}</td></tr>`+
    plan.rows.map(r=>`<tr${r.first?' class="row-hit"':''}><td>${mShort(r.m)}${r.first?' ✅':''}</td><td>${f0(r.start)}</td><td class="pos">+ ${f0(r.interest)}</td><td>${ap?'+ '+f0(ap):'—'}</td><td><b>${f0(r.end)}</b></td><td>${pc(Math.min(r.end/goal,1))}</td><td>${r.reached?'✅ atingida':f0(goal-r.end)}</td><td class="mut">${f0(r.low)}${r.low>=goal?' ✅':''}</td></tr>`).join('');
  $('projTbl').innerHTML=rows;
  $('projSum').textContent=`Projeção mês a mês (${plan.rows.length+1} linhas)`;
  $('projHelp').innerHTML=`Juros sobre juros: cada mês rende sobre o saldo do mês anterior, já com os juros acumulados. Taxa: <b>${rateText(S.rate)}% a.a. líquido</b> (${pc(plan.rate)} ao mês) e aporte de <b>${f0(ap)}/mês</b>. A coluna “Se juros caírem” usa ${rateText(lowerRate())}% a.a. Valores líquidos, partindo do saldo de hoje.`;
}

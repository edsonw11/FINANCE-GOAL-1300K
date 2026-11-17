/**
 * ui/views/summary-hero.js
 * Responsibility: the main number of the Summary, "Sobrou no mês" (domain/month-result.js), with how
 * much of it was invested and how much stayed in the account; the card invoice of today under it; and
 * the emergency reserve card, shown only when an account is marked as the reserve.
 */
import { $ } from '../../core/dom.js';
import { f2, pc } from '../../core/format.js';
import { formatDateBR, mLabel, mOf, today } from '../../core/dates.js';
import { monthResult } from '../../domain/month-result.js';
import { emergencyFund } from '../../domain/emergency-fund.js';
import { dueDateOf, dueMonth } from '../../domain/card-cycle.js';
import { cycleTotals } from '../../domain/card-status.js';
import { ui } from '../ui-state.js';
import { invoiceName } from '../invoice-name.js';
const LEVEL_TEXT={
  good:'Excelente: você guardou boa parte do que ganhou.',ok:'Bom: dá para chegar a 20% se cortar um pouco.',
  low:'Pouco: sobrou menos de 10% do que entrou.',negative:'Você gastou mais do que ganhou neste mês.',none:'Sem receitas neste mês.'};
const RESERVE_TEXT={good:'Reserva confortável.',ok:'Reserva razoável: a meta é 6 meses.',low:'Reserva curta: a meta é 6 meses.',none:''};
const months=v=>v.toFixed(1).replace('.',',');
// the invoice that is open today (same name and number as the Card tab)
function invoiceLine(){
  const fm=dueMonth(today()),t=cycleTotals(fm),rest=Math.max(0,t.bought-t.paid);
  return rest>0.004?`<div class="hero-line">💳 ${invoiceName(fm)}: <b>${f2(rest)}</b> · vence ${formatDateBR(dueDateOf(fm))}</div>`:'';
}
export function renderHero(){
  const r=monthResult(ui.cur),isNow=ui.cur===mOf(today());
  const sign=r.left<0?'−':'';
  $('monthHero').className='card mt-10 month-hero '+r.level;
  $('monthHero').innerHTML=`<div class="hero-k">Sobrou em ${mLabel(ui.cur).toLowerCase()}${isNow?' (até hoje)':''}</div>
    <div class="hero-v">${sign}${f2(Math.abs(r.left))}</div>
    <div class="hero-n">${r.rate===null?'':`${pc(r.rate)} do que entrou · `}${LEVEL_TEXT[r.level]}</div>
    ${r.invested>0||r.left!==0?`<div class="hero-split"><span>📈 Investiu <b>${f2(r.invested)}</b></span><span>🏦 ${r.kept>=0?'Ficou na conta':'Saiu da conta'} <b>${f2(Math.abs(r.kept))}</b></span></div>`:''}
    ${isNow?invoiceLine():''}`;
  const e=emergencyFund(today()),el=$('reserveCard');
  el.hidden=!e.accounts.length;
  el.innerHTML=!e.accounts.length?'':e.months===null
    ?`<div class="k">🛟 Reserva de emergência</div><div class="v">${f2(e.balance)}</div><div class="n">Falta histórico de despesas para calcular quantos meses ela cobre.</div>`
    :`<div class="k">🛟 Reserva de emergência</div><div class="v">${months(e.months)} meses</div><div class="n">${f2(e.balance)} cobrem ${months(e.months)} meses de gastos (média ${f2(e.monthlyExpense)}/mês). ${RESERVE_TEXT[e.level]}</div>`;
  el.className='card kpi health mt-10 '+e.level;
}

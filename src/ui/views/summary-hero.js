/**
 * ui/views/summary-hero.js
 * Responsibility: the main number of the Summary, "Sobrou no mês" (domain/month-result.js), with how
 * much of it was invested and how much stayed in the account; the card invoice of today under it; and
 * the emergency reserve card, shown only when an account is marked as the reserve.
 */
import { $ } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f2, pc } from '../../core/format.js';
import { formatDateBR, mLabel, mOf, today } from '../../core/dates.js';
import { monthResult } from '../../domain/month-result.js';
import { emergencyFund } from '../../domain/emergency-fund.js';
import { dueDateOf, dueMonth } from '../../domain/card-cycle.js';
import { cycleTotals } from '../../domain/card-status.js';
import { ui } from '../ui-state.js';
import { invoiceName } from '../invoice-name.js';
// getters: the text follows the active language at the moment it is read (also read by report-html.js)
export const LEVEL_TEXT={
  get good(){return t('sum.hero.levelGood');},get ok(){return t('sum.hero.levelOk');},
  get low(){return t('sum.hero.levelLow');},get negative(){return t('sum.hero.levelNegative');},get none(){return t('sum.hero.levelNone');}};
const RESERVE_TEXT={get good(){return t('sum.hero.reserveGood');},get ok(){return t('sum.hero.reserveOk');},get low(){return t('sum.hero.reserveLow');},none:''};
const months=v=>v.toFixed(1).replace('.',',');
// the invoice that is open today (same name and number as the Card tab)
function invoiceLine(){
  const fm=dueMonth(today()),cy=cycleTotals(fm),rest=Math.max(0,cy.bought-cy.paid);
  return rest>0.004?`<div class="hero-line">${t('sum.hero.invoice',{name:invoiceName(fm),value:f2(rest),date:formatDateBR(dueDateOf(fm))})}</div>`:'';
}
export function renderHero(){
  const r=monthResult(ui.cur),isNow=ui.cur===mOf(today());
  const sign=r.left<0?'−':'';
  $('monthHero').className='card mt-10 month-hero '+r.level;
  $('monthHero').innerHTML=`<div class="hero-k">${t(isNow?'sum.hero.leftInToday':'sum.hero.leftIn',{month:mLabel(ui.cur).toLowerCase()})}</div>
    <div class="hero-v">${sign}${f2(Math.abs(r.left))}</div>
    <div class="hero-n">${r.rate===null?LEVEL_TEXT[r.level]:t('sum.hero.rateNote',{percent:pc(r.rate),level:LEVEL_TEXT[r.level]})}</div>
    ${r.invested>0||r.left!==0?`<div class="hero-split"><span>${t('sum.hero.invested',{value:f2(r.invested)})}</span><span>${t(r.kept>=0?'sum.hero.kept':'sum.hero.taken',{value:f2(Math.abs(r.kept))})}</span></div>`:''}
    ${isNow?invoiceLine():''}`;
  const e=emergencyFund(today()),el=$('reserveCard');
  el.hidden=!e.accounts.length;
  el.innerHTML=!e.accounts.length?'':e.months===null
    ?`<div class="k">${t('sum.hero.reserveTitle')}</div><div class="v">${f2(e.balance)}</div><div class="n">${t('sum.hero.reserveNoHistory')}</div>`
    :`<div class="k">${t('sum.hero.reserveTitle')}</div><div class="v">${t('sum.hero.reserveMonths',{months:months(e.months)})}</div><div class="n">${t('sum.hero.reserveCovers',{balance:f2(e.balance),months:months(e.months),average:f2(e.monthlyExpense),note:RESERVE_TEXT[e.level]})}</div>`;
  el.className='card kpi health mt-10 '+e.level;
}

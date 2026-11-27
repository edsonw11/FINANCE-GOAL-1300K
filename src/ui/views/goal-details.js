/**
 * ui/views/goal-details.js
 * Responsibility: what the Goal tab cards open: net worth by account and the recorded yield per month.
 */
import { esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f2 } from '../../core/format.js';
import { formatDateBR, today } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { balance, total } from '../../domain/accounts.js';
import { realSeries } from '../../domain/investments.js';
import { accColor } from '../account-colors.js';
import { infoRow, listView, signedMoney } from '../components/breakdown.js';
import { registerDetail } from '../components/detail-registry.js';
import { goTab } from '../navigation.js';
import { periodOf } from './month-details.js';
// net worth by account (Meta tab)
function netWorthView(){
  return listView(()=>{const d=today(),acs=S.accounts.map(a=>({a,b:balance(a.id,d)})).filter(x=>!x.a.archived||Math.abs(x.b.v)>0.005);
    return {title:t('sum.goalDetails.netWorthTitle'),sub:t('sum.goalDetails.today',{date:formatDateBR(d)}),total:f2(total(d)),totalLabel:t('sum.goalDetails.netTotal'),unit:t('sum.goalDetails.unitAccount'),units:t('sum.goalDetails.unitAccounts'),
      groups:[{rows:acs.map(({a,b})=>infoRow({icon:`<i class="dot" style="background:${accColor(a.id)}"></i>`,title:esc(a.name),sub:b.snap?t(['sum.goalDetails.balanceAsOf','sum.goalDetails.balanceAsOfAfter','sum.goalDetails.balanceAsOfEst','sum.goalDetails.balanceAsOfAfterEst'][(b.v!==b.snap.value?1:0)+(b.snap.est?2:0)],{date:formatDateBR(b.snap.date)}):t('sum.accounts.noBalance'),value:f2(b.v),attrs:'data-go="tab" data-t="inv"'}))}],
      note:t('sum.goalDetails.updateNote')};});
}
function historyView(){
  return listView(()=>{const real=realSeries(),ys=real.filter(r=>r.y!==null);
    return {title:t('sum.goalDetails.yieldTitle'),sub:t('sum.goalDetails.yieldSub'),total:(sumMoney(ys.map(r=>r.y))>=0?'+ ':'')+f2(sumMoney(ys.map(r=>r.y))),totalLabel:t('sum.goalDetails.yieldTotal'),unit:t('sum.goalDetails.unitMonth'),units:t('sum.goalDetails.unitMonths'),
      groups:[{rows:[...real].reverse().map(r=>infoRow({icon:'📈',title:periodOf(r.m),sub:r.ap?t('sum.goalDetails.netWorthRowAp',{value:f2(r.t),contrib:f2(r.ap)}):t('sum.goalDetails.netWorthRow',{value:f2(r.t)}),value:r.y===null?'<span class="mut">—</span>':signedMoney(r.y),vcls:r.y===null?'':r.y>=0?'pos':'neg'}))}],
      note:t('sum.goalDetails.yieldNote')};});
}
export function registerGoalDetails(){
  registerDetail('networth',netWorthView);
  registerDetail('yield',historyView);
  registerDetail('eta',()=>{goTab('proj');return null;}); // the projection lives in the goal tab (goTab scrolls to it)
}

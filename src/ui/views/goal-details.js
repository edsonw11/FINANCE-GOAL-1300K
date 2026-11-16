/**
 * ui/views/goal-details.js
 * Responsibility: what the Goal tab cards open: net worth by account and the recorded yield per month.
 */
import { esc } from '../../core/dom.js';
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
    return {title:'Patrimônio líquido',sub:'Hoje, '+formatDateBR(d),total:f2(total(d)),totalLabel:'Total líquido',unit:'conta',units:'contas',
      groups:[{rows:acs.map(({a,b})=>infoRow({icon:`<i class="dot" style="background:${accColor(a.id)}"></i>`,title:esc(a.name),sub:b.snap?'Saldo de '+formatDateBR(b.snap.date)+(b.v!==b.snap.value?' + aportes depois':'')+(b.snap.est?' (estimado)':''):'Sem saldo informado',value:f2(b.v),attrs:'data-go="tab" data-t="inv"'}))}],
      note:'Para atualizar, use Investimentos → Atualizar saldos.'};});
}
function historyView(){
  return listView(()=>{const real=realSeries(),ys=real.filter(r=>r.y!==null);
    return {title:'Rendimento registrado',sub:'Meses com saldo atualizado',total:(sumMoney(ys.map(r=>r.y))>=0?'+ ':'')+f2(sumMoney(ys.map(r=>r.y))),totalLabel:'Soma dos rendimentos',unit:'mês',units:'meses',
      groups:[{rows:[...real].reverse().map(r=>infoRow({icon:'📈',title:periodOf(r.m),sub:'Patrimônio '+f2(r.t)+(r.ap?' · aportes '+f2(r.ap):''),value:r.y===null?'<span class="mut">—</span>':signedMoney(r.y),vcls:r.y===null?'':r.y>=0?'pos':'neg'}))}],
      note:'O rendimento é a diferença do patrimônio menos os aportes. Só aparece nos meses em que você atualizou os saldos.'};});
}
export function registerGoalDetails(){
  registerDetail('networth',netWorthView);
  registerDetail('yield',historyView);
  registerDetail('eta',()=>{goTab('proj');return null;}); // the projection lives in the goal tab (goTab scrolls to it)
}

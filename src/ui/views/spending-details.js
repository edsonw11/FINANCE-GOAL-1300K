/**
 * ui/views/spending-details.js
 * Responsibility: what the spending cards open: list of months (Média mensal, Último mês fechado,
 * Tendência) and lists of categories (Gastos fixos, Variáveis, Concentração). Statistics come
 * from domain/spending-stats.js.
 */
import { esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { f2 } from '../../core/format.js';
import { mShort } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { groupIcon } from '../../domain/category-groups.js';
import { groupMonth, spendingWindow } from '../../domain/spending.js';
import { CATEGORY_KIND, categoryStats, closedMonthsByGroup } from '../../domain/spending-stats.js';
import { ui } from '../ui-state.js';
import { Sheet } from '../components/sheet.js';
import { infoRow, listView } from '../components/breakdown.js';
import { registerDetail, registerLink } from '../components/detail-registry.js';
import { goTab } from '../navigation.js';
import { periodOf } from './month-details.js';
import { openGroup } from './category-sheet.js';
// list of months (trend cards and "Média mensal"): each month opens its expenses
function monthsView(title,keys){
  return listView(()=>{
    const w=spendingWindow(ui.cur),idx=keys==='closed'?w.ci:keys==='last2'?w.ci.slice(-2):w.ms.map((m,k)=>k);
    const tot=sumMoney(idx.map(k=>w.vals[k])),avg=idx.length?tot/idx.length:0;
    return {title,sub:t('sum.spending.monthByMonth'),total:f2(avg),totalLabel:t('sum.spending.avgPerMonth'),unit:t('sum.goalDetails.unitMonth'),units:t('sum.goalDetails.unitMonths'),
      note:t('sum.spending.sumNote',{count:idx.length,total:f2(tot)}),
      groups:[{rows:idx.slice().reverse().map(k=>infoRow({icon:'📅',title:periodOf(w.ms[k]),sub:k>0&&w.vals[k-1]>0?t('sum.spending.vsMonth',{arrow:w.vals[k]>=w.vals[k-1]?'▲':'▼',amount:f2(Math.abs(w.vals[k]-w.vals[k-1])),month:mShort(w.ms[k-1])}):'',value:f2(w.vals[k]),attrs:`data-go="month" data-m="${w.ms[k]}"`}))}]};
  });
}
function categoriesView(title,names,note){
  return listView(()=>{const w=spendingWindow(ui.cur),cl=w.ci.map(k=>groupMonth(w.ms[k])),tot=c=>sumMoney(cl.map(x=>x[c]||0));
    const list=names.map(c=>({c,t:tot(c)})).sort((a,b)=>b.t-a.t);
    return {title,sub:t('sum.spending.closedMonths'),total:f2(sumMoney(list.map(x=>x.t))),totalLabel:t('sum.spending.totalPeriod'),unit:t('sum.spending.unitGroup'),units:t('sum.spending.unitGroups'),note,
      groups:[{rows:list.map(x=>infoRow({icon:groupIcon(x.c),title:esc(displayName(x.c)),sub:t('sum.spending.avgSub',{value:f2(x.t/(cl.length||1))}),value:f2(x.t),attrs:`data-go="cat" data-c="${esc(x.c)}"`}))}]};});
}
// [title key, picker, note key]: the texts are read when the sheet opens, in the active language
const CATEGORY_GROUPS={
  fixed:['sum.spending.fixedTitle',st=>st.list.filter(z=>z.kind===CATEGORY_KIND.fixed),'sum.spending.fixedNote'],
  variable:['sum.spending.variableTitle',st=>st.list.filter(z=>z.kind===CATEGORY_KIND.variable),'sum.spending.variableNote'],
  top3:['sum.spending.top3Title',st=>st.list.slice(0,3),'sum.spending.top3Note']};
export function registerSpendingDetails(){
  registerDetail('avg',()=>monthsView(t('sum.trend.avgMonthly'),'closed'));
  registerDetail('lastmonth',()=>monthsView(t('sum.trend.lastClosed'),'last2'));
  registerDetail('trend',()=>monthsView(t('sum.spending.trendTitle'),'all'));
  Object.entries(CATEGORY_GROUPS).forEach(([key,[title,pick,note]])=>registerDetail(key,()=>categoriesView(t(title),pick(categoryStats(closedMonthsByGroup(ui.cur))).map(z=>z.c),t(note))));
  registerLink('cat',el=>openGroup(el.dataset.c,el.dataset.m));
  registerLink('tab',el=>{Sheet.close();goTab(el.dataset.t);});
}

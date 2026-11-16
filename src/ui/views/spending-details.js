/**
 * ui/views/spending-details.js
 * Responsibility: what the spending cards open: list of months (Média mensal, Último mês fechado,
 * Tendência) and lists of categories (Gastos fixos, Variáveis, Concentração). Statistics come
 * from domain/spending-stats.js.
 */
import { esc } from '../../core/dom.js';
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
    return {title,sub:'Gastos mês a mês',total:f2(avg),totalLabel:'Média por mês',unit:'mês',units:'meses',
      note:`Soma dos ${idx.length} mês(es): <b>${f2(tot)}</b>. Só entram meses já fechados (o mês atual ainda está em andamento).`,
      groups:[{rows:idx.slice().reverse().map(k=>infoRow({icon:'📅',title:periodOf(w.ms[k]),sub:k>0&&w.vals[k-1]>0?`${w.vals[k]>=w.vals[k-1]?'▲':'▼'} ${f2(Math.abs(w.vals[k]-w.vals[k-1]))} vs ${mShort(w.ms[k-1])}`:'',value:f2(w.vals[k]),attrs:`data-go="month" data-m="${w.ms[k]}"`}))}]};
  });
}
function categoriesView(title,names,note){
  return listView(()=>{const w=spendingWindow(ui.cur),cl=w.ci.map(k=>groupMonth(w.ms[k])),tot=c=>sumMoney(cl.map(x=>x[c]||0));
    const list=names.map(c=>({c,t:tot(c)})).sort((a,b)=>b.t-a.t);
    return {title,sub:'Meses fechados',total:f2(sumMoney(list.map(x=>x.t))),totalLabel:'Total no período',unit:'grupo',units:'grupos',note,
      groups:[{rows:list.map(x=>infoRow({icon:groupIcon(x.c),title:esc(x.c),sub:'Média '+f2(x.t/(cl.length||1))+'/mês',value:f2(x.t),attrs:`data-go="cat" data-c="${esc(x.c)}"`}))}]};});
}
const CATEGORY_GROUPS={
  fixed:['Gastos fixos',st=>st.list.filter(z=>z.kind===CATEGORY_KIND.fixed),'Grupos com valor quase igual todo mês.'],
  variable:['Gastos variáveis',st=>st.list.filter(z=>z.kind===CATEGORY_KIND.variable),'Cortar 10% destes grupos é o potencial de economia mostrado.'],
  top3:['Maiores grupos',st=>st.list.slice(0,3),'Os 3 grupos que mais pesam no período.']};
export function registerSpendingDetails(){
  registerDetail('avg',()=>monthsView('Média mensal','closed'));
  registerDetail('lastmonth',()=>monthsView('Último mês fechado','last2'));
  registerDetail('trend',()=>monthsView('Tendência dos gastos','all'));
  Object.entries(CATEGORY_GROUPS).forEach(([key,[title,pick,note]])=>registerDetail(key,()=>categoriesView(title,pick(categoryStats(closedMonthsByGroup(ui.cur))).map(z=>z.c),note)));
  registerLink('cat',el=>openGroup(el.dataset.c,el.dataset.m));
  registerLink('tab',el=>{Sheet.close();goTab(el.dataset.t);});
}

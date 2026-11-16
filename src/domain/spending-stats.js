/**
 * domain/spending-stats.js
 * Responsibility: statistics of the spending: least-squares trend line (used by the chart and by
 * the analysis) and the per-group/category profile (Fixo / Variável / Pontual, change vs. previous months).
 */
import { sumMoney } from '../core/money.js';
import { groupMonth, spendingWindow } from './spending.js';
export function linearTrend(xs,ys){
  const n=Math.min(xs.length,ys.length),avg=n?ys.slice(0,n).reduce((a,b)=>a+b,0)/n:0;
  if(n<2)return {slope:0,intercept:avg,avg};
  const mx=xs.slice(0,n).reduce((a,b)=>a+b,0)/n;let num=0,den=0;
  for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-avg);den+=(xs[i]-mx)**2;}
  const slope=den?num/den:0;
  return {slope,intercept:avg-slope*mx,avg};
}
export const CATEGORY_KIND={fixed:'Fixo',variable:'Variável',occasional:'Pontual'};
// months: [{m, v (month total), c: {category: value}}], oldest first
export function categoryStats(months){
  const N=months.length,total=sumMoney(months.map(x=>x.v)),average=N?total/N:0;
  const names=[...new Set(months.flatMap(x=>Object.keys(x.c)))];
  const list=names.map(c=>{
    const a=months.map(x=>x.c[c]||0),t=sumMoney(a),mean=t/N,sd=Math.sqrt(a.reduce((s,z)=>s+(z-mean)**2,0)/N);
    const freq=a.filter(z=>z>0).length/N,cv=mean?sd/mean:0;
    const prev=a.slice(Math.max(0,N-4),N-1),base=prev.length?prev.reduce((x,y)=>x+y,0)/prev.length:null,cur=a[N-1];
    const kind=freq<0.5?CATEGORY_KIND.occasional:cv<=0.15?CATEGORY_KIND.fixed:CATEGORY_KIND.variable;
    return {c,a,t,mean,cv,freq,kind,base,cur,d:base===null?null:cur-base,p:base>0?(cur-base)/base:null,share:total?t/total:0};
  }).sort((x,y)=>y.t-x.t);
  const meanOf=k=>list.filter(z=>z.kind===k).reduce((s,z)=>s+z.mean,0);
  return {list,total,average,
    fixed:meanOf(CATEGORY_KIND.fixed),variable:meanOf(CATEGORY_KIND.variable),occasional:meanOf(CATEGORY_KIND.occasional),
    top3Share:total?list.slice(0,3).reduce((s,z)=>s+z.t,0)/total:0};
}
// closed months of the spending window with their per-group totals (input of categoryStats:
// the analysis compares groups, e.g. Moradia = condomínio + luz + água + gás)
export function closedMonthsByGroup(sel){const w=spendingWindow(sel);return w.ci.map(k=>({m:w.ms[k],v:w.vals[k],c:groupMonth(w.ms[k])}));}

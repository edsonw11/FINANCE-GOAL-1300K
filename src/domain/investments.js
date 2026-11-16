/**
 * domain/investments.js
 * Responsibility: Real net-worth series and projection (compound interest, scenarios).
 */
import { sum } from '../core/format.js';
import { asOf, mIdx, mKey, mOf, today } from '../core/dates.js';
import { S } from './store.js';
import { balance, total } from './accounts.js';
import { contributionsInMonth } from './transactions.js';
import { ASSET_LABEL } from './ticker-class.js';
function firstMonth(){const ds=S.snaps.map(s=>s.date).concat(S.tx.filter(t=>t.type==='aporte').map(t=>t.date)).sort();return mOf(ds[0]||today());} // no balance or aporte yet (a blank app): start this month
function monthsList(){const a=mIdx(firstMonth()),b=mIdx(mOf(today()));const r=[];for(let i=a;i<=b;i++)r.push(mKey(i));return r;}
// where the money is, as {total, items:[{id, name, value, share, count}]} biggest first (share of the total).
// by 'account': one item per account with a balance; beyond MAX_SLICES the small ones become "Outras".
// by 'type': accounts named like an asset class (Ações, FIIs, ETFs, BDRs) by class, everything else is "Renda fixa e outros".
export const DIST_MAX_SLICES=7,DIST_OTHER_ID='_other',DIST_FIXED_ID='_fixed';
export function investmentDistribution(day=today(),by='account'){
  const rows=S.accounts.filter(a=>!a.archived).map(a=>({id:a.id,name:a.name,value:balance(a.id,day).v})).filter(r=>r.value>0.005);
  const tot=rows.reduce((x,r)=>x+r.value,0);
  let items=rows.map(r=>({...r,count:1}));
  if(by==='type'){
    const g={};
    rows.forEach(r=>{const cls=Object.keys(ASSET_LABEL).find(k=>ASSET_LABEL[k]===r.name),id=cls||DIST_FIXED_ID,name=cls?r.name:'Renda fixa e outros';
      const x=g[id]||(g[id]={id,name,value:0,count:0});x.value+=r.value;x.count++;});
    items=Object.values(g);
  }
  items.sort((a,b)=>b.value-a.value);
  if(by!=='type'&&items.length>DIST_MAX_SLICES+1){
    const rest=items.slice(DIST_MAX_SLICES),sum=rest.reduce((x,r)=>x+r.value,0);
    items=items.slice(0,DIST_MAX_SLICES).concat([{id:DIST_OTHER_ID,name:'Outras ('+rest.length+')',value:sum,count:rest.length}]);
  }
  return {total:tot,items:items.map(r=>({...r,share:tot?r.value/tot:0}))};
}
export function realSeries(){
  const ms=monthsList();
  return ms.map((m,n)=>{
    const d=asOf(m),t=total(d),ap=contributionsInMonth(m);
    let y=null;
    if(n>0){const pd=asOf(ms[n-1]);const upd=S.snaps.some(s=>s.date>pd&&s.date<=d);if(upd)y=t-total(pd)-ap;}
    return {m,d,t,ap,y,bal:S.accounts.map(a=>balance(a.id,d).v),prev:n>0?total(asOf(ms[n-1])):null};
  });
}
export function avgContribution(real){
  const done=real.slice(0,-1).slice(-3).map(r=>r.ap);
  if(done.length)return sum(done)/done.length;
  return real[real.length-1].ap;
}
export function project(real){
  const last=real[real.length-1],m=Math.pow(1+S.rate/100,1/12)-1,out=[];let b=last.t,hit=last.t>=S.goal?0:null;
  for(let n=1;n<=60;n++){b=b*(1+m)+S.planned;out.push({m:mKey(mIdx(last.m)+n),t:b});
    if(hit===null&&b>=S.goal)hit=n; if(hit!==null&&n>=Math.max(hit+1,5))break;}
  return {proj:out,hit,m};
}

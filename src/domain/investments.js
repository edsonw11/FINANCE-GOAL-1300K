/**
 * domain/investments.js
 * Responsibility: Real net-worth series and projection (compound interest, scenarios).
 */
function firstMonth(){const ds=S.snaps.map(s=>s.date).concat(S.tx.filter(t=>t.type==='aporte').map(t=>t.date)).sort();return mOf(ds[0]);}
function monthsList(){const a=mIdx(firstMonth()),b=mIdx(mOf(today()));const r=[];for(let i=a;i<=b;i++)r.push(mKey(i));return r;}
function realSeries(){
  const ms=monthsList();
  return ms.map((m,n)=>{
    const d=asOf(m),t=total(d),ap=contributionsInMonth(m);
    let y=null;
    if(n>0){const pd=asOf(ms[n-1]);const upd=S.snaps.some(s=>s.date>pd&&s.date<=d);if(upd)y=t-total(pd)-ap;}
    return {m,d,t,ap,y,bal:S.accounts.map(a=>balance(a.id,d).v),prev:n>0?total(asOf(ms[n-1])):null};
  });
}
function avgContribution(real){
  const done=real.slice(0,-1).slice(-3).map(r=>r.ap);
  if(done.length)return sum(done)/done.length;
  return real[real.length-1].ap;
}
function project(real){
  const last=real[real.length-1],m=Math.pow(1+S.rate/100,1/12)-1,out=[];let b=last.t,hit=last.t>=S.goal?0:null;
  for(let n=1;n<=60;n++){b=b*(1+m)+S.planned;out.push({m:mKey(mIdx(last.m)+n),t:b});
    if(hit===null&&b>=S.goal)hit=n; if(hit!==null&&n>=Math.max(hit+1,5))break;}
  return {proj:out,hit,m};
}

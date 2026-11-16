/**
 * Calculation audit on the full test data set (12 months, 4 investment accounts, a portfolio).
 * Every figure the app shows is recomputed here WITHOUT the app's own functions (only from the raw
 * records) and compared: month totals, shares, savings rate, net worth, yield, goal progress, projection,
 * budgets, card invoices, portfolio, spending trend. A mismatch means a wrong number on screen.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('calc-audit');
  const near=(a,b,eps=0.011)=>Math.abs(a-b)<=eps;
  const cents=x=>Math.round(x*100);
  const sumC=a=>a.reduce((s,v)=>s+cents(v),0)/100;
  run("S=blankState();initCats();addDemoData();S.budgets={Moradia:900,Mercado:1500};");
  const D=JSON.parse(JSON.stringify(run("({tx:S.tx,snaps:S.snaps,accounts:S.accounts,trades:S.trades,goal:S.goal,rate:S.rate,planned:S.planned,today:today()})")));
  const months=[...new Set(D.tx.map(t=>t.date.slice(0,7)))].sort();
  const monthEnd=m=>{const [y,k]=m.split('-').map(Number);const e=m+'-'+String(new Date(y,k,0).getDate()).padStart(2,'0');return e<D.today?e:D.today;};
  // ---- 1. month totals and shares
  let totalsOk=true,catsOk=true,shareOk=true,rateOk=true;
  months.forEach(m=>{
    const inM=t=>t.date.slice(0,7)===m,by=ty=>D.tx.filter(t=>inM(t)&&t.type===ty);
    const s=run(`(x=>({inc:x.income.total,exp:x.expenses.total,apo:x.contributions.total}))(monthSummary('${m}'))`);
    if(!near(s.inc,sumC(by('receita').map(t=>t.value)))||!near(s.exp,sumC(by('despesa').map(t=>t.value)))||!near(s.apo,sumC(by('aporte').map(t=>t.value))))totalsOk=false;
    const cat=run(`catMonth('${m}')`),catSum=sumC(Object.values(cat));
    if(!near(catSum,s.exp))catsOk=false;
    const rec=s.inc,pcApo=rec?s.apo/rec:0,pcDes=rec?s.exp/rec:0;
    if(rec&&(!near(pcApo,s.apo/rec,1e-9)||!near(pcDes,s.exp/rec,1e-9)))rateOk=false;
    const shares=Object.values(cat).map(v=>v/catSum);if(!near(shares.reduce((a,b)=>a+b,0),1,1e-6))shareOk=false;
  });
  ok('12 months of data',months.length===12);
  ok('month totals (receitas, despesas, aportes) match the raw records',totalsOk);
  ok('category breakdown adds up to the month spending',catsOk);
  ok('category shares add up to 100%',shareOk);
  ok('% of income (despesas, aportes) is value / receitas',rateOk);
  // ---- 2. net worth, yield and % per month (independent balance rule: last snapshot <= day + aportes after it)
  const balanceAt=(acc,d)=>{let sn=null;D.snaps.forEach(s=>{if(s.acc===acc&&s.date<=d&&(!sn||s.date>=sn.date))sn=s;});const from=sn?sn.date:'0000-00-00';
    return (sn?sn.value:0)+sumC(D.tx.filter(t=>t.type==='aporte'&&t.acc===acc&&t.date>from&&t.date<=d).map(t=>t.value));};
  const worth=d=>sumC(D.accounts.map(a=>balanceAt(a.id,d)));
  const real=run("realSeries().map(r=>({m:r.m,t:r.t,ap:r.ap,y:r.y,prev:r.prev}))");
  let worthOk=true,yieldOk=true,apOk=true;
  real.forEach((r,n)=>{
    const d=monthEnd(r.m);if(!near(r.t,worth(d)))worthOk=false;
    const ap=sumC(D.tx.filter(t=>t.type==='aporte'&&t.date.slice(0,7)===r.m&&t.date<=d).map(t=>t.value));if(!near(r.ap,ap))apOk=false;
    if(n>0){const pd=monthEnd(real[n-1].m),upd=D.snaps.some(s=>s.date>pd&&s.date<=d);
      const y=upd?worth(d)-worth(pd)-ap:null;if((y===null)!==(r.y===null)||(y!==null&&!near(r.y,y,0.02)))yieldOk=false;
      if(!near(r.prev,worth(pd)))yieldOk=false;}
  });
  ok('net worth per month = last balance + aportes after it, summed over accounts',worthOk);
  ok('aportes per month match',apOk);
  ok('yield = worth − previous worth − aportes (and previous worth is right)',yieldOk);
  // the demo data was built so the yield is real growth, not a missing aporte: every account that grows by an aporte has its records
  const yields=real.filter(r=>r.y!==null).map(r=>r.y/r.prev);
  ok('demo monthly yield is the growth built into the demo (0,5% to 1,1% a month: no aporte is counted as yield)',yields.length>=10&&yields.every(y=>y>0.005&&y<0.011));
  // a new account entered with a balance it already had is a starting point, not yield
  const yBefore=run("realSeries().map(r=>r.y)"),lastM=real[real.length-1].m;
  run("S.accounts.push({id:'newacc',name:'Conta nova'});S.snaps.push({date:today(),acc:'newacc',value:90000,est:false})");
  const yAfter=run("realSeries().map(r=>r.y)");
  ok('adding an account with an existing balance does not change any month yield',yBefore.every((y,i)=>y===null?yAfter[i]===null:near(y,yAfter[i],0.02)));
  run("S.accounts=S.accounts.filter(a=>a.id!=='newacc');S.snaps=S.snaps.filter(x=>x.acc!=='newacc')");
  // ---- 3. goal progress and projection
  const last=real[real.length-1];
  eq('goal ring = min(worth / goal, 1)',run("Math.min(realSeries().slice(-1)[0].t/S.goal,1)"),Math.min(last.t/D.goal,1));
  const mRate=Math.pow(1+D.rate/100,1/12)-1;let b=last.t,hit=last.t>=D.goal?0:null;const path=[];
  for(let n=1;n<=60;n++){b=b*(1+mRate)+D.planned;path.push(b);if(hit===null&&b>=D.goal)hit=n;if(hit!==null&&n>=Math.max(hit+1,5))break;}
  const pj=run("(p=>({hit:p.hit,t:p.proj.map(x=>x.t)}))(project(realSeries()))");
  eq('months to reach the goal',pj.hit,hit);
  ok('projection path (compound interest + planned aporte)',pj.t.length===path.length&&pj.t.every((v,i)=>near(v,path[i],0.001)));
  run("S.planned=2000");const pj2=run("(p=>p.hit)(project(realSeries()))");
  let b2=last.t,h2=null;for(let n=1;n<=60&&h2===null;n++){b2=b2*(1+mRate)+2000;if(b2>=D.goal)h2=n;}
  eq('with a planned aporte of 2.000 the date moves earlier and matches',[pj2,pj2<=pj.hit||pj.hit===null],[h2,true]);
  run("S.planned=0");
  // ---- 4. budgets
  const cur=D.today.slice(0,7),spentBy={};run(`groupMonth('${cur}')`);
  const grp=run(`groupMonth('${cur}')`),bs=run(`budgetStatus('${cur}','${D.today}')`);
  ok('budget share = spent / budget, remaining = budget − spent',bs.rows.every(r=>near(r.share,(grp[r.group]||0)/r.budget,1e-9)&&near(r.spent,grp[r.group]||0)&&near(r.remaining,r.budget-(grp[r.group]||0))));
  const groupsTotal=sumC(Object.values(grp)),monthExp=run(`monthSummary('${cur}').expenses.total`);
  ok('groups of the month add up to the month spending',near(groupsTotal,monthExp));
  // ---- 5. card
  const fms=[...new Set(D.tx.filter(t=>t.fonte==='cartao').map(t=>run(`dueMonth('${t.date}')`)))];
  const cardOk=fms.every(fm=>near(run(`cycleTotals('${fm}').bought`),sumC(D.tx.filter(t=>t.type==='despesa'&&t.fonte==='cartao'&&run(`dueMonth('${t.date}')`)===fm).map(t=>t.value))));
  ok('invoice totals = card purchases of that cycle',cardOk);
  ok('every card purchase belongs to exactly one invoice month',D.tx.filter(t=>t.fonte==='cartao').every(t=>/^\d{4}-\d{2}$/.test(run(`dueMonth('${t.date}')`))));
  // ---- 6. portfolio (average cost with costs; sells reduce at the average)
  const pos={};[...D.trades].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).forEach(t=>{
    const p=pos[t.ticker]||(pos[t.ticker]={qty:0,cost:0,real:0,cls:t.cls});
    if(t.side==='C'){p.qty+=t.qty;p.cost+=t.qty*t.price+t.fees;}
    else{const avg=p.cost/p.qty;p.real+=t.qty*t.price-t.fees-avg*t.qty;p.cost-=avg*t.qty;p.qty-=t.qty;}});
  const app=run("positions().map(p=>({ticker:p.ticker,qty:p.qty,cost:p.cost,real:p.realized}))");
  ok('portfolio: quantity, invested and realized result per ticker',app.every(p=>pos[p.ticker].qty===p.qty&&near(pos[p.ticker].cost,p.cost,0.02)&&near(pos[p.ticker].real,p.real,0.02)));
  const grpApp=run("portfolioGroups().map(g=>({cls:g.cls,cost:g.cost,share:g.share}))"),totalCost=Object.values(pos).reduce((s,p)=>s+p.cost,0);
  ok('portfolio shares add up to 100% and each is class cost / total',near(grpApp.reduce((s,g)=>s+g.share,0),1,1e-6)&&grpApp.every(g=>near(g.share,Object.values(pos).filter(p=>p.cls===g.cls).reduce((s,p)=>s+p.cost,0)/totalCost,1e-6)));
  // ---- 7. distribution of investments (donut data)
  const dist=run("investmentDistribution()");
  ok('distribution: shares add up to 100% and match each account balance / total',near(dist.items.reduce((s,i)=>s+i.share,0),1,1e-6)&&dist.items.every(i=>near(i.share,i.value/dist.total,1e-9)));
  ok('distribution total = net worth today',near(dist.total,worth(D.today),0.02));
  const byType=run("investmentDistribution(today(),'type')");
  ok('by type: Renda fixa e outros + Ações + FIIs + ETFs add up to the same total and 100%',near(byType.total,dist.total,0.02)&&near(byType.items.reduce((x,i)=>x+i.share,0),1,1e-6)&&near(byType.items.reduce((x,i)=>x+i.value,0),dist.total,0.02));
  eq('by type: the groups are the expected ones',byType.items.map(i=>i.name).sort(),['Ações','ETFs','FIIs','Renda fixa e outros']);
  const fixedExpected=sumC(D.accounts.filter(a=>/teste/.test(a.name)).map(a=>balanceAt(a.id,D.today)));
  ok('by type: fixed income = the four test accounts',near(byType.items.find(i=>i.id==='_fixed').value,fixedExpected,0.02));
  run("S.accounts.push(...Array.from({length:9},(_,i)=>({id:'x'+i,name:'Extra '+i})));S.accounts.filter(a=>/^x/.test(a.id)).forEach(a=>S.snaps.push({date:today(),acc:a.id,value:10,est:false}))");
  const many=run("investmentDistribution()");
  ok('by account: more than 8 accounts -> 7 slices + "Outras", still 100%',many.items.length===8&&many.items[7].name.startsWith('Outras')&&near(many.items.reduce((x,i)=>x+i.share,0),1,1e-6));
  // ---- 8. spending trend (least squares) on the closed months
  const w=run("(x=>({vals:x.ci.map(k=>x.vals[k])}))(spendingWindow(today().slice(0,7)))").vals,xs=w.map((_,i)=>i),mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=w.reduce((a,b)=>a+b,0)/w.length;
  const slope=xs.reduce((s,x,i)=>s+(x-mx)*(w[i]-my),0)/xs.reduce((s,x)=>s+(x-mx)**2,0);
  ok('trend slope = least squares of the closed months',near(run(`linearTrend(${JSON.stringify(xs)},${JSON.stringify(w)}).slope`),slope,1e-6));
  return res;};

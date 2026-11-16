/** Spending window, trend line and per-category statistics (domain/spending.js, domain/spending-stats.js). */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,near,ok,res}=suite('spending');
  // trend line: least squares
  const t=run("linearTrend([0,1,2,3],[100,110,120,130])");
  near('slope',t.slope,10);near('intercept',t.intercept,100);near('average',t.avg,115);
  near('flat slope',run("linearTrend([0,1,2],[50,50,50]).slope"),0);
  eq('needs 2 points',run("linearTrend([0],[5]).slope"),0);
  // category stats: Fixo (same value), Variável, Pontual (<half of the months)
  const st=run(`categoryStats([
    {m:'2026-07',v:600,c:{Moradia:500,Mercado:100}},
    {m:'2026-08',v:700,c:{Moradia:500,Mercado:200}},
    {m:'2026-09',v:1100,c:{Moradia:500,Mercado:300,Viagem:300}},
    {m:'2026-10',v:900,c:{Moradia:500,Mercado:400}}])`);
  eq('sorted by total',st.list.map(z=>z.c),['Moradia','Mercado','Viagem']);
  eq('kinds',st.list.map(z=>z.kind),['Fixo','Variável','Pontual']);
  eq('total',st.total,3300);near('average',st.average,825);
  near('fixed per month',st.fixed,500);near('variable per month',st.variable,250);near('occasional per month',st.occasional,75);
  near('last vs previous average (Mercado)',st.list[1].d,200);
  near('share',st.list[0].share,2000/3300);
  near('top 3 share',st.top3Share,1);
  // window: 12 months, closed months only for averages
  run("S=seed();S.tx=[];[['2026-08-10',100],['2026-09-10',200],['2026-10-10',300],['2026-11-05',50]].forEach(([d,v],i)=>S.tx.push({id:i+1,type:'despesa',date:d,value:v,cat:'Mercado',fonte:'caixa'}));");
  const w=run("spendingWindow('2026-11')");
  eq('12 months',w.ms.length,12);eq('ends at the selected month',w.ms[11],w.nowM>'2026-11'?w.ms[11]:'2026-11');
  ok('current month is partial',w.part[w.ms.indexOf(w.nowM)]===true||w.ms.indexOf(w.nowM)<0);
  ok('closed months exclude the current one',w.ci.every(k=>w.ms[k]<w.nowM));
  return res;};

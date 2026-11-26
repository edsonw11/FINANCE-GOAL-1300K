/**
 * Rules that must hold for ANY ledger, checked on 60 seeded random ledgers (same seed, same ledgers: nothing here is flaky), against an independent oracle written
 * from the documented rules: income of a month is the sum of its incomes, expenses are the sum of its expenses, left = income - expenses, the groups of the report add
 * up to the expenses (also when a record is split across categories), and the order of the records never matters.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('finance-invariants');
  let st=20261126;const rnd=()=>{st=(st*1664525+1013904223)>>>0;return st/4294967296;};
  const pick=a=>a[Math.floor(rnd()*a.length)],cents=n=>Math.round(n*100)/100;
  const CATS=['Mercado','Aluguel','Uber','Restaurantes','Luz','Farmácia','Lazer','Salário'],FONTES=['caixa','cartao','beneficio'];
  const MONTHS_OF_DATA=['2026-09','2026-10','2026-11'];
  const ledger=()=>{const n=1+Math.floor(rnd()*60),tx=[];
    for(let i=1;i<=n;i++){const m=pick(MONTHS_OF_DATA),day=String(1+Math.floor(rnd()*28)).padStart(2,'0'),kind=rnd();
      const value=cents(0.01+rnd()*(rnd()<0.1?50000:900));
      const t={id:i,type:kind<0.3?'receita':kind<0.9?'despesa':'aporte',date:`${m}-${day}`,value,cat:pick(CATS),desc:'r'+i,fonte:pick(FONTES)};
      if(t.type==='aporte'){t.acc='a1';t.fonte='caixa';}
      if(t.type==='despesa'&&rnd()<0.2&&value>=1){const part=cents(value*(0.1+rnd()*0.5));t.splits=[{cat:pick(CATS),value:part}];}
      tx.push(t);}
    return tx;};
  const load=tx=>run(`S=blankState();S.accounts=[{id:'a1',name:'CDB'}];S.snaps=[{date:'2026-01-01',acc:'a1',value:1000}];S.cats=undefined;delete S.catsV2;delete S.catsV3;delete S.catsV4;initCats();S.tx=${JSON.stringify(tx)};true`);
  const sumC=(a)=>Math.round(a.reduce((t,v)=>t+Math.round(v*100),0))/100;
  const MONTHS=['2026-09','2026-10','2026-11'];
  const bad={income:[],expenses:[],left:[],kept:[],rate:[],groups:[],order:[]};let months=0,nonEmpty=0;
  for(let k=0;k<60;k++){
    const tx=ledger();load(tx);
    for(const m of MONTHS){
      months++;const inM=t=>t.date.startsWith(m);
      const income=sumC(tx.filter(t=>t.type==='receita'&&inM(t)).map(t=>t.value)),expenses=sumC(tx.filter(t=>t.type==='despesa'&&inM(t)).map(t=>t.value)),invested=sumC(tx.filter(t=>t.type==='aporte'&&inM(t)).map(t=>t.value));
      const r=run(`monthResult('${m}')`);if(income>0||expenses>0)nonEmpty++;
      if(r.income!==income)bad.income.push([k,m,r.income,income]);
      if(r.expenses!==expenses)bad.expenses.push([k,m,r.expenses,expenses]);
      if(r.left!==cents(income-expenses))bad.left.push([k,m,r.left,cents(income-expenses)]);
      if(r.invested!==invested||r.kept!==cents(cents(income-expenses)-invested))bad.kept.push([k,m,r.kept]);
      if((income>0)!==(r.rate!==null)||(r.rate!==null&&Math.abs(r.rate-(cents(income-expenses)/income))>1e-12))bad.rate.push([k,m,r.rate]);
      const rep=run(`buildReport('${m}','2026-11-20')`),gsum=sumC(rep.spending.map(g=>g.value));
      if(Math.abs(gsum-expenses)>0.011*Math.max(1,rep.spending.length))bad.groups.push([k,m,gsum,expenses]);
    }
    load(tx.slice().reverse());
    for(const m of MONTHS){const a=JSON.stringify(run(`monthResult('${m}')`));load(tx);const b=JSON.stringify(run(`monthResult('${m}')`));load(tx.slice().reverse());if(a!==b)bad.order.push([k,m]);}
  }
  eq('income of a month is the sum of its incomes (to the cent)',bad.income.slice(0,2),[]);
  eq('expenses of a month are the sum of its expenses (to the cent)',bad.expenses.slice(0,2),[]);
  eq('left is income minus expenses',bad.left.slice(0,2),[]);
  eq('invested is the sum of the contributions and kept is left minus invested',bad.kept.slice(0,2),[]);
  eq('the savings rate exists only with income, and is left over income',bad.rate.slice(0,2),[]);
  eq('the groups of the report add up to the expenses, also with split records',bad.groups.slice(0,2),[]);
  eq('the order of the records does not change a month',bad.order.slice(0,2),[]);
  ok('the generator really produced many months with money in them ('+nonEmpty+' of '+months+')',nonEmpty>100);
  return res;};

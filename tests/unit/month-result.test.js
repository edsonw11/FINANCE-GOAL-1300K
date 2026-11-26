/**
 * The one "left this month" number and its split (invested / kept in the account).
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('month-result');
  const tx=(id,type,date,value,extra)=>JSON.stringify({id,type,date,value,cat:'Outros',desc:'x',fonte:'caixa',...extra});
  run(`S=blankState();S.accounts=[{id:'a1',name:'CDB'}];S.tx=[${tx(1,'receita','2026-10-05',1000)},${tx(2,'despesa','2026-10-06',650)},${tx(3,'aporte','2026-10-07',500,{acc:'a1'})}]`);
  const r=run("monthResult('2026-10')");
  eq('left = income - expenses, same rule as the savings rate',[r.left,r.rate,r.level],[350,0.35,'good']);
  eq('invested more than was left: kept is negative (came from the account)',[r.invested,r.kept],[500,-150]);
  run(`S.tx.push(${tx(4,'despesa','2026-10-08',200,{fonte:'cartao'})})`);
  eq('a card purchase is an expense of the month even if the invoice is not paid yet',run("monthResult('2026-10').left"),150);
  run(`S.tx=[${tx(1,'despesa','2026-10-06',50)}]`);
  eq('no income: no rate',run("(r=>[r.left,r.rate,r.level])(monthResult('2026-10'))"),[-50,null,'none']);
  eq('agrees with savingsRate',run("monthResult('2026-10').left===savingsRate('2026-10').saved"),true);
  run(`S.tx=[${tx(1,'receita','2026-10-05',0.5)},${tx(2,'despesa','2026-10-06',0.25)}]`);
  eq('a tiny income still gives a rate (only zero income means "no rate")',run("(r=>[r.left,r.rate])(monthResult('2026-10'))"),[0.25,0.5]);
  return res;};

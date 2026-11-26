/**
 * The numbers of the printed report: they must agree with the screens (same month result, same groups),
 * the small groups are folded into "Outros", an empty month says so, and what only makes sense for
 * the month in progress (attention, card, comparison) is left out of a closed month. Values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('report');
  const J=JSON.stringify;
  const tx=(id,type,date,value,cat,extra)=>J({id,type,date,value,cat,desc:cat+' '+id,fonte:'caixa',...extra});
  const fresh=txs=>run(`S=blankState();S.accounts=[{id:'a1',name:'CDB'}];S.snaps=[{date:'2026-10-31',acc:'a1',value:50000}];S.cats=undefined;delete S.catsV2;delete S.catsV3;delete S.catsV4;initCats();S.tx=[${txs.join(',')}]`);
  const DAY='2026-11-20';
  // ---- a normal closed month
  fresh([tx(1,'receita','2026-10-05',10000,'Salário'),tx(2,'despesa','2026-10-06',3000,'Aluguel'),tx(3,'despesa','2026-10-07',500,'Mercado'),
    tx(4,'despesa','2026-10-08',200,'Uber'),tx(5,'aporte','2026-10-09',1000,'x',{acc:'a1'}),tx(6,'despesa','2026-09-10',2000,'Aluguel'),tx(7,'receita','2026-09-05',8000,'Salário')]);
  let r=run(`buildReport('2026-10','${DAY}')`);
  eq('the month result is the one of the screens',[r.month.income,r.month.expenses,r.month.left,r.month.invested],[10000,3700,6300,1000]);
  eq('the same as monthResult',run("JSON.stringify(buildReport('2026-10','"+DAY+"').month)===JSON.stringify(monthResult('2026-10'))"),true);
  eq('closed month: no attention list, no card, a comparison with the month before',[r.current,r.attention.length,r.card,r.compare&&r.compare.m],[false,0,null,'2026-09']);
  eq('comparison: spent 1700 more than in September',[r.compare.delta,Math.round(r.compare.pct*100)],[1700,85]);
  eq('groups (as in the screens: Mercado is in Alimentação): biggest first, with their share of the expenses',r.spending.map(g=>[g.name,g.value,Math.round(g.share*100)]),[['Aluguel',3000,81],['Alimentação',500,14],['Uber',200,5]]);
  eq('the groups add up to the expenses',Math.round(r.spending.reduce((t,g)=>t+g.value,0)*100),370000);
  eq('biggest expenses, biggest first',r.biggest.map(b=>[b.cat,b.value]),[['Aluguel',3000],['Mercado',500],['Uber',200]]);
  eq('the last months stop at the first month with records',r.trend.rows.map(t=>[t.m,t.left]),[['2026-09',6000],['2026-10',6300]]);
  eq('average of what was left, closed months',r.trend.averageLeft,6150);
  eq('goal block',[r.goal.target,r.goal.networth,r.goal.reached,r.goal.progress>0&&r.goal.progress<1],[1300000,50000,false,true]);
  eq('investments by account',r.investments.items.map(i=>[i.name,i.value]),[['CDB',50000]]);
  eq('no budgets, no reserve marked: those parts are left out',[r.budgets,r.reserve],[null,null]);
  // ---- many groups: the small ones are folded
  const many=['A','B','C','D','E','F','G','H'].map((c,i)=>tx(10+i,'despesa','2026-10-10',100*(8-i),c));
  fresh([tx(1,'receita','2026-10-05',5000,'Salário')].concat(many));
  r=run(`buildReport('2026-10','${DAY}')`);
  eq('at most 6 groups plus "Outros"',[r.spending.length,r.spending[6].name,r.spending[6].value,r.spending[6].count],[7,'Outros',300,2]);
  eq('the total is kept',Math.round(r.spending.reduce((t,g)=>t+g.value,0)),3600);
  eq('only the 5 biggest expenses',r.biggest.length,5);
  // ---- the month in progress
  fresh([tx(1,'receita','2026-11-03',4000,'Salário'),tx(2,'despesa','2026-11-04',1000,'Mercado',{fonte:'cartao'}),tx(3,'despesa','2026-10-04',800,'Mercado')]);
  r=run(`buildReport('2026-11','${DAY}')`);
  eq('current month: flagged, no comparison with a whole month',[r.current,r.compare],[true,null]);
  eq('the open card invoice is there',[r.card&&r.card.rest,r.card&&r.card.fm],[1000,run("dueMonth('"+DAY+"')")]);
  eq('the average leaves the month in progress out',r.trend.rows.map(t=>t.m),['2026-10','2026-11']);
  eq('attention is the same list as "O que fazer agora"',r.attention.map(a=>a.code),run(`nextActions('${DAY}')`).map(a=>a.code));
  // ---- an empty month and a blank app
  fresh([]);
  r=run(`buildReport('2026-11','${DAY}')`);
  eq('no records but a balance: there is something to show, and the lists are empty',[r.hasData,r.spending.length,r.biggest.length],[true,0,0]);
  run("S=blankState();S.accounts=[];S.snaps=[];S.tx=[]");
  r=run(`buildReport('2026-11','${DAY}')`);
  eq('truly blank app: no data, one trend row, no investments',[r.hasData,r.trend.rows.length,r.investments,r.trend.averageLeft],[false,1,null,null]);
  // ---- budgets and reserve show when they exist
  fresh([tx(1,'receita','2026-10-05',5000,'Salário'),tx(2,'despesa','2026-10-06',900,'Mercado'),tx(3,'despesa','2026-09-06',900,'Mercado')]);
  run("S.accounts[0].reserve=true;setBudget('Alimentação',500)");
  r=run(`buildReport('2026-10','${DAY}')`);
  eq('budget over the limit and the reserve are in the report',[r.budgets.rows.map(b=>[b.group,b.level]),r.reserve.accounts.length],[[['Alimentação','over']],1]);
  return res;};

/**
 * Savings rate, emergency reserve and the "what to do now" list.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,near,res}=suite('finance-desk');
  const tx=(id,type,date,value,extra)=>JSON.stringify({id,type,date,value,cat:'Outros',desc:'x'+id,fonte:'caixa',...extra});
  // savings rate
  run(`S=blankState();S.tx=[${tx(1,'receita','2026-10-05',1000)},${tx(2,'despesa','2026-10-06',750)}]`);
  const s=run("savingsRate('2026-10')");
  eq('saved and rate',[s.saved,s.rate,s.level],[250,0.25,'good']);
  eq('levels',[0.15,0.05,-0.1,null].map(r=>run(`savingsLevel(${r})`)),['ok','low','negative','none']);
  run(`S.tx=[${tx(1,'despesa','2026-10-06',50)}]`);
  eq('no income: no rate',run("savingsRate('2026-10')").level,'none');
  // reserve
  run(`S=blankState();S.accounts=[{id:'a1',name:'Reserva'},{id:'a2',name:'Ações'}];
    S.snaps=[{date:'2026-10-01',acc:'a1',value:6000,est:false},{date:'2026-10-01',acc:'a2',value:9000,est:false}];
    S.tx=[${[7,8,9].map((m,i)=>tx(i+1,'despesa','2026-0'+m+'-10',1000)).join(',')}]`);
  eq('no account marked: unknown',run("emergencyFund('2026-10-20')").months,null);
  ok('mark account',!run("setReserveAccount('a1',true)").error);
  const r=run("emergencyFund('2026-10-20')");
  eq('months covered by the reserve',[r.balance,r.monthlyExpense,r.months,r.level],[6000,1000,6,'good']);
  run("setReserveAccount('a1',false)");
  eq('unmark',run("reserveAccounts().length"),0);
  ok('unknown account is an error',!!run("setReserveAccount('zz',true)").error);
  // next actions
  run(`S=blankState();S.accounts=[];S.tx=[]`);
  eq('nothing to do on a blank app',run("nextActions('2026-10-20')"),[]);
  run(`S.accounts=[{id:'a1',name:'CDB'}]`);
  eq('invests but no contribution this month (after day 10)',run("nextActions('2026-10-20').map(a=>a.code)"),['no-contribution']);
  eq('not before day 10',run("nextActions('2026-10-05').length"),0);
  run(`S.tx=[${tx(1,'aporte','2026-10-02',100,{acc:'a1'})}]`);
  eq('contributed: quiet',run("nextActions('2026-10-20').length"),0);
  run(`S=seed();initCats();S.accounts=[{id:'a1',name:'CDB'}];S.snaps=[];S.tx=[];S.budgets={'Moradia':100};S.tx.push(${tx(2,'despesa','2026-10-03',300,{cat:'Moradia'})})`);
  const over=run("nextActions('2026-10-20')");
  ok('budget over appears with its group',over.some(a=>a.code==='budget-over'&&a.data.groups.length===1));
  run(`S=blankState();S.accounts=[];S.tx=[${tx(1,'despesa','2026-01-10',100,{fonte:'cartao'})},${tx(2,'despesa','2026-02-10',50,{fonte:'cartao'})}]`);
  const lateItems=run("nextActions('2026-10-20').filter(a=>a.code==='invoice-late')");
  eq('late invoices are one item with count and total',[lateItems.length,lateItems[0].data.count,lateItems[0].data.rest],[1,2,150]);
  run(`S=blankState();S.tx=[]`);
  const many=run("nextActions('2026-10-20').length");
  ok('never more than 3',many<=3);
  return res;};

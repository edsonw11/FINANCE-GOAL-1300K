/**
 * Month window of the spending analysis, meal-voucher balances, card purchases still open, and the "has data" flag of the report.
 * Found by a fresh mutation sample. Expected values were worked out by hand from the records below.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,res}=suite('spending-and-vouchers');
  const tx=(id,type,date,value,extra)=>JSON.stringify({id,type,date,value,cat:'Outros',desc:'x',fonte:'caixa',...extra});
  // ---- the closed months of the window: with spending, before the current month; never the current one, a future one, or an empty one
  run(`S=blankState();S.tx=[${tx(1,'despesa','2026-08-05',100)},${tx(2,'despesa','2026-09-05',0.5)},${tx(3,'despesa','2026-10-05',200)},${tx(4,'despesa','2026-11-05',50)},${tx(5,'despesa','2026-12-05',999)}];`);
  eq('closed months with spending: Aug, Sep (even 0.50) and Oct; not Nov (current), not Dec (future), not the empty ones',run("(w=>w.ci.map(k=>w.ms[k]))(spendingWindow('2026-11'))"),['2026-08','2026-09','2026-10']);
  eq('asking for a later month moves the window but the current month is still not closed',run("(w=>w.ci.map(k=>w.ms[k]))(spendingWindow('2026-12'))"),['2026-08','2026-09','2026-10']);
  // ---- meal voucher: balance before the month, what came and went in it, and the total (100 - 30 = 70 before; +50 -20)
  run(`S=blankState();S.tx=[${tx(1,'receita','2026-10-02',100,{fonte:'beneficio'})},${tx(2,'despesa','2026-10-03',30,{fonte:'beneficio'})},${tx(3,'receita','2026-11-02',50,{fonte:'beneficio'})},${tx(4,'despesa','2026-11-03',20,{fonte:'beneficio'})}];`);
  eq('voucher: before 70, in the month 50, out 20, total 100',run("(s=>[s.voucher.before,s.voucher.inMonth,s.voucher.outMonth,s.voucher.total])(monthSummary('2026-11'))"),[70,50,20,100]);
  // a record of another type on the voucher balance (a transfer) counts as 0, not as 1, in the balance before the month
  run(`S=blankState();S.tx=[${tx(1,'receita','2026-10-02',100,{fonte:'beneficio'})},${tx(2,'transferencia','2026-10-04',40,{fonte:'beneficio'})}];`);
  eq('voucher balance before the month ignores other record types',run("monthSummary('2026-11').voucher.before"),100);
  // ---- card purchases not yet on an invoice: the invoice's own purchases are offered too when it is being edited
  run(`S=blankState();S.card={best:29,due:7,biz:false,over:{},v3:true};S.tx=[${tx(1,'despesa','2026-10-02',100,{fonte:'cartao'})},${tx(2,'despesa','2026-10-03',40,{fonte:'cartao'})},${tx(3,'fatura','2026-11-07',100,{fm:'2026-11',cat:'Fatura do cartão'})}];_al=null;`);
  eq('purchase 1 (100) fills the invoice of 100; only purchase 2 is open',run("openCard(null).map(t=>t.id)"),[2]);
  eq('editing that invoice also offers its own purchase',run("openCard(null,3).map(t=>t.id)"),[1,2]);
  // ---- the report knows when there is nothing to show
  const has=setup=>run(`S=blankState();S.accounts=[{id:'a',name:'A'}];${setup};buildReport('2026-11','2026-11-20').hasData`);
  eq('report "has data": nothing, an expense, an income, a contribution, only a balance',
    [has('S.tx=[]'),has(`S.tx=[${tx(1,'despesa','2026-11-05',10)}]`),has(`S.tx=[${tx(1,'receita','2026-11-05',10)}]`),has(`S.tx=[${tx(1,'aporte','2026-11-05',10,{acc:'a'})}]`),has("S.tx=[];S.snaps=[{date:'2026-09-01',acc:'a',value:500,est:false}]")],[false,true,true,true,true]);
  return res;};

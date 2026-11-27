/**
 * Reinvestment (bug found by the owner): a CDB that matured and was applied again was counted as a NEW investment in "Investido", took the money out of the month's
 * leftover, lowered the yield and inflated the average aporte. An aporte marked as reinvestment (reinv) is only a record: it is not new money anywhere, and it does not
 * change a balance. A normal aporte is unchanged. Values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,res}=suite('reinvestment');
  const load=(extra)=>run(`S=seed();S.tx=[];S.accounts=[{id:'cdb',name:'CDB'},{id:'nu',name:'Nubank'}];S.snaps=[];var _id=1;var add=o=>S.tx.push(Object.assign({id:_id++},o));
    add({type:'receita',date:'2026-10-05',value:10000,cat:'Salário',fonte:'caixa'});
    add({type:'despesa',date:'2026-10-07',value:2000,cat:'Mercado',fonte:'caixa'});
    add({type:'aporte',date:'2026-10-10',value:1000,acc:'cdb'});
    add({type:'aporte',date:'2026-10-13',value:6541,acc:'cdb',reinv:true});_al=null;${extra||''}`);
  load();
  // ---- the predicates
  eq('isReinvestment / isNewContribution on the three kinds of record',run(`[{type:'aporte',reinv:true},{type:'aporte'},{type:'aporte',reinv:false},{type:'despesa',reinv:true}].map(t=>[isReinvestment(t),isNewContribution(t)])`),[[true,false],[false,true],[false,true],[false,false]]);
  // ---- the month summary: Investido, cash, the list apart
  const s=run("monthSummary('2026-10')");
  eq('Investido counts only the new money (1000, not 7541)',s.contributions.total,1000);
  eq('the contribution list has only the normal aporte',s.contributions.items.map(t=>t.id),[3]);
  eq('the reinvestment is listed apart with its own total',[s.reinvestments.items.map(t=>t.id),s.reinvestments.total],[[4],6541]);
  eq('the cash of the month only loses the new money: 10000 - 2000 - 1000',s.cash.total,7000);
  eq('the cash list of aportes has no reinvestment',s.cash.contributions.map(t=>t.id),[3]);
  // ---- the numbers of the summary screen (Sobrou / Ficou na conta)
  const r=run("monthResult('2026-10')");
  eq('invested in the month result is the new money only',r.invested,1000);
  eq('what stayed in the account: 10000 - 2000 - 1000, not minus 7541 as well',r.kept,7000);
  // ---- balances do not move with a reinvestment
  eq('the balance of the account counts the normal aporte only (no snapshot yet: 1000)',run("balance('cdb','2026-11-20').v"),1000);
  run("S.snaps=[{date:'2026-10-01',acc:'cdb',value:5000,est:false}];");
  eq('with a typed balance, only normal aportes after it are added (5000 + 1000)',run("balance('cdb','2026-11-20').v"),6000);
  eq('the reinvestment does not change the total either',run("total('2026-11-20')"),6000);
  // ---- contributions of the month for the yield and the average
  eq('contributionsInMonth is the new money',run("contributionsInMonth('2026-10')"),1000);
  eq('realSeries has the new money as aportes of the month (the yield is not lowered by the reinvestment)',run("realSeries().find(r=>r.m==='2026-10').ap"),1000);
  load("add({type:'aporte',date:'2026-09-02',value:500,acc:'cdb'});add({type:'aporte',date:'2026-09-12',value:9000,acc:'cdb',reinv:true});add({type:'aporte',date:'2026-08-02',value:300,acc:'cdb'});add({type:'aporte',date:'2026-11-02',value:100,acc:'cdb'});");
  eq('the average aporte of the last closed months ignores reinvestments ((300 + 500 + 1000) / 3 = 600)',run("avgContribution(realSeries())"),600);
  // the yield of a month in which a NEW account starts: its first balance is where it starts, not yield, and a reinvestment into it is not new money either
  run("S=seed();S.tx=[];S.accounts=[{id:'nu',name:'Nubank'},{id:'cdb',name:'CDB'}];S.snaps=[{date:'2026-09-30',acc:'nu',value:1000,est:false},{date:'2026-10-31',acc:'nu',value:1100,est:false},{date:'2026-10-31',acc:'cdb',value:6541,est:false}];S.tx=[{id:1,type:'aporte',date:'2026-10-13',value:6541,acc:'cdb',reinv:true}];_al=null;");
  eq('a new account that starts with a reinvestment: the month yield is only the 100 earned in Nubank',run("realSeries().find(r=>r.m==='2026-10').y"),100);
  run("S.tx[0].reinv=false;_al=null;");
  eq('the same record as a normal aporte: the 6541 are new money, and the yield is the same 100',run("realSeries().find(r=>r.m==='2026-10').y"),100);
  // ---- "nenhum aporte neste mês ainda" is not silenced by a reinvestment
  const nextMonth=run("S.tx=S.tx.filter(t=>t.date<'2026-10-01'||t.date>'2026-10-31'||t.type!=='aporte'||!!t.reinv);S.accounts=[{id:'cdb',name:'CDB'}];_al=null;nextActions('2026-10-20').some(i=>i.code===ACTION.contribute)");
  eq('only a reinvestment in the month: the "no aporte this month" reminder still shows',nextMonth,true);
  eq('with a normal aporte it does not',run("(()=>{S.tx.push({id:900,type:'aporte',date:'2026-10-15',value:10,acc:'cdb'});return nextActions('2026-10-20').some(i=>i.code===ACTION.contribute);})()"),false);
  // ---- saving: the mark is stored only on an aporte, and can be removed by editing
  run("S=seed();S.tx=[];S.accounts=[{id:'cdb',name:'CDB'}];initCats();");
  run("saveTransaction({editId:null,type:'aporte',value:500,date:'2026-10-13',acc:'cdb',reinv:true,repeat:1})");
  run("saveTransaction({editId:null,type:'aporte',value:100,date:'2026-10-14',acc:'cdb',repeat:1})");
  run("saveTransaction({editId:null,type:'despesa',value:50,date:'2026-10-15',cat:'Mercado',fonte:'caixa',reinv:true,splits:[],repeat:1})");
  eq('the mark is stored on the marked aporte only (an expense never gets it)',run("S.tx.map(t=>t.reinv===true)"),[true,false,false]);
  run("saveTransaction({editId:S.tx[0].id,type:'aporte',value:500,date:'2026-10-13',acc:'cdb',reinv:false,repeat:1})");
  eq('editing with the mark off removes the key (the stored record is clean)',run("'reinv' in S.tx[0]"),false);
  run("saveTransaction({editId:S.tx[1].id,type:'aporte',value:100,date:'2026-10-14',acc:'cdb',reinv:true,repeat:1})");
  eq('editing with the mark on adds it',run("S.tx[1].reinv"),true);
  eq('a series of reinvestments keeps the mark in every month',run("(()=>{S.tx=[];saveTransaction({editId:null,type:'aporte',value:10,date:'2026-01-05',acc:'cdb',reinv:true,repeat:3});return S.tx.map(t=>t.reinv);})()"),[true,true,true]);
  // ---- an old backup (no mark anywhere) behaves exactly as before
  load();run("S.tx.forEach(t=>delete t.reinv);_al=null;");
  eq('without any mark every aporte is new money (7541 invested)',run("monthSummary('2026-10').contributions.total"),7541);
  return res;};

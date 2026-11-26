/**
 * Monthly yield of the investments (domain/investments.js realSeries): the growth of balances, without the contributions and without the start of an account
 * that began in the month. Worked by hand below. Found by a fresh mutation sample.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,res}=suite('investment-yield');
  const tx=(id,type,date,value,extra)=>JSON.stringify({id,type,date,value,cat:'Outros',desc:'x',fonte:'caixa',...extra});
  const rows=()=>run("realSeries().filter(r=>r.m>='2026-09'&&r.m<='2026-10').map(r=>[r.m,r.t,r.ap,r.y])");
  // A grows 1000 -> 1100 in Sep (+100) and 1100 -> 1210 in Oct (+110). B is a new account: 300 contributed on 20 Sep, first balance 600 on 15 Oct.
  // B's first balance is where it starts, not yield: so the yield of Oct is only A's 110, and of Sep only A's 100.
  run(`S=blankState();S.accounts=[{id:'a',name:'A'},{id:'b',name:'B'}];S.snaps=[{date:'2026-08-31',acc:'a',value:1000,est:false},{date:'2026-09-30',acc:'a',value:1100,est:false},{date:'2026-10-15',acc:'b',value:600,est:false},{date:'2026-10-31',acc:'a',value:1210,est:false}];S.tx=[${tx(1,'aporte','2026-09-20',300,{acc:'b'})}];_al=null;`);
  const r=rows();
  eq('September: total 1100 + 300 contributed, contribution 300, yield 100',r[0],['2026-09',1400,300,100]);
  eq('October: total 1210 + 600, no contribution, yield 110 (the start of B is not yield)',r[1],['2026-10',1810,0,110]);
  // an account that existed before only changes its balance: that growth is yield
  run(`S=blankState();S.accounts=[{id:'a',name:'A'}];S.snaps=[{date:'2026-08-31',acc:'a',value:1000,est:false},{date:'2026-10-31',acc:'a',value:1100,est:false}];S.tx=[];_al=null;`);
  eq('no balance entered in September: no yield for September (null), October takes the whole 100 of growth',rows().map(x=>x[3]),[null,100]);
  // the distribution lists only accounts worth more than half a cent
  run(`S=blankState();S.accounts=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];S.snaps=[{date:'2026-10-31',acc:'a',value:0.005,est:false},{date:'2026-10-31',acc:'b',value:0.01,est:false},{date:'2026-10-31',acc:'c',value:50,est:false}];S.tx=[];_al=null;`);
  eq('distribution leaves out an account of exactly 0.005 and keeps 0.01',run("investmentDistribution('2026-11-20').items.map(i=>i.id).sort()"),['b','c']);
  return res;};

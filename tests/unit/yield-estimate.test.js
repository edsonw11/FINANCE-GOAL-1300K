/**
 * The bars of "Evolução e projeção" used to add only the aportes between two typed balances, so the yield showed up all at once at the next typed balance
 * (bug found by the owner). Now the yield between two typed balances is spread over the days in between. Values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,ok,near,res}=suite('yield-estimate');
  const load=(snaps,tx)=>run(`S=seed();S.tx=${JSON.stringify(tx||[])}.map((t,i)=>Object.assign({id:i+1},t));S.accounts=[{id:'a',name:'A'}];S.snaps=${JSON.stringify(snaps)}.map(s=>Object.assign({acc:'a',est:false},s));_al=null;`);
  const eb=d=>run(`estimatedBalance('a','${d}')`);
  // ---- no aporte: constant growth between the two typed balances
  load([{date:'2026-01-31',value:1000},{date:'2026-03-31',value:1020}]);
  const k=Math.pow(1.02,28/59)*1000; // 28 days after the first balance, 59 between the two
  near('the middle of the stretch grows with a constant daily factor (1000 * 1.02^(28/59))',eb('2026-02-28').v,k,0.01);
  eq('it is flagged as an estimate',eb('2026-02-28').estimated,true);
  eq('the typed balance is exact on its own day',eb('2026-01-31').v,1000);
  ok('between the two balances it only goes up (yield is positive)',['2026-02-05','2026-02-15','2026-03-10','2026-03-30'].map(d=>eb(d).v).every((v,i,a)=>v>1000&&v<1020&&(i===0||v>a[i-1])));
  eq('after the LAST typed balance nothing is estimated: the real balance',eb('2026-04-30'),{v:1020,estimated:false});
  eq('the day of the last typed balance is the typed value',eb('2026-03-31'),{v:1020,estimated:false});
  // ---- negative yield goes down, also monotone
  load([{date:'2026-01-31',value:1000},{date:'2026-03-31',value:990}]);
  ok('a loss goes down between the balances',['2026-02-05','2026-02-28','2026-03-30'].map(d=>eb(d).v).every((v,i,a)=>v<1000&&v>990&&(i===0||v<a[i-1])));
  // ---- an aporte inside the stretch is a flow: the balance steps up by it and then grows
  load([{date:'2026-01-31',value:1000},{date:'2026-03-31',value:1600}],[{type:'aporte',date:'2026-02-15',value:500,acc:'a'}]);
  ok('the day before the aporte the balance is still below it (1000 + the yield of 14 days)',eb('2026-02-14').v<1030);
  ok('the day of the aporte the balance has it (>= 1500)',eb('2026-02-15').v>=1500);
  ok('on the last day before the typed balance it is at most that balance',eb('2026-03-30').v<1600&&eb('2026-03-30').v>eb('2026-02-15').v);
  // ---- first aporte up to the first typed balance (no starting balance)
  load([{date:'2026-03-10',value:1100}],[{type:'aporte',date:'2026-01-10',value:1000,acc:'a'}]);
  ok('before the first typed balance the aporte grows towards it (1000 < v < 1100)',eb('2026-02-10').v>1000&&eb('2026-02-10').v<1100);
  eq('the day of the aporte it is the aporte',eb('2026-01-10').v,1000);
  // ---- an implausible implied yield is not spread: the old behaviour (aportes only)
  load([{date:'2026-01-31',value:1000},{date:'2026-02-28',value:5000}]);
  eq('money deposited without an aporte (yield above the limit): the real balance, not an estimate',eb('2026-02-10'),{v:1000,estimated:false});
  load([{date:'2026-01-31',value:1000},{date:'2026-02-28',value:100}]);
  eq('a drop below the lower limit is not spread either (a withdrawal not entered)',eb('2026-02-10'),{v:1000,estimated:false});
  // ---- a reinvestment is not new money: it is not a flow, so the stretch stays plausible
  load([{date:'2026-01-31',value:1000},{date:'2026-02-28',value:1010}],[{type:'aporte',date:'2026-02-10',value:6541,acc:'a',reinv:true}]);
  ok('with the reinvestment ignored, the yield is spread (1000 < v < 1010)',eb('2026-02-20').v>1000&&eb('2026-02-20').v<1010&&eb('2026-02-20').estimated);
  load([{date:'2026-01-31',value:1000},{date:'2026-02-28',value:7600}],[{type:'aporte',date:'2026-02-10',value:6541,acc:'a'}]);
  ok('the same value as a NEW aporte is a flow: 1000 + 6541 grows to 7600',eb('2026-02-20').v>7541&&eb('2026-02-20').v<7600);
  // ---- impliedRate: the bounds
  const rate=(a,b)=>run(`impliedRate({date:'2026-01-01',value:${a}},[],'2027-01-01',${b})`);
  ok('1000 to 1900 in a year is plausible',rate(1000,1900)!==null);
  eq('1000 to 2100 in a year is above 100 % a year: no rate',rate(1000,2100),null);
  ok('1000 to 600 in a year is plausible',rate(1000,600)!==null);
  eq('1000 to 400 in a year is below -50 %: no rate',rate(1000,400),null);
  near('the rate solves the equation: 1000 * e^(rho * 365) = 1500',1000*Math.exp(rate(1000,1500)*365),1500,0.01);
  eq('the limits are the documented ones',run('[MAX_ANNUAL,MIN_ANNUAL]'),[1,-0.5]);
  // ---- an aporte on the day of the starting balance is already inside that balance: it is not a flow
  load([{date:'2026-01-31',value:1000},{date:'2026-03-31',value:1020}],[{type:'aporte',date:'2026-01-31',value:500,acc:'a'}]);
  near('an aporte on the snapshot day is not counted twice: the middle is still 1000 * 1.02^(28/59)',eb('2026-02-28').v,k,0.01);
  // ---- no yield at all: nothing to spread
  load([{date:'2026-01-31',value:1000},{date:'2026-03-31',value:1000}]);
  eq('two equal balances and no aporte: the real balance, not flagged as an estimate',eb('2026-02-28'),{v:1000,estimated:false});
  // ---- the estimate is rounded to the cent
  load([{date:'2026-01-31',value:1000},{date:'2026-03-31',value:1020}]);
  const v=eb('2026-02-28').v;ok('the estimated balance has at most two decimals',Math.abs(v*100-Math.round(v*100))<1e-9);
  // ---- realSeries: the estimate shows in the bars, but the yield and the previous total stay real
  load([{date:'2026-01-31',value:1000},{date:'2026-03-31',value:1020}]);
  const rows=run("realSeries().map(r=>({m:r.m,t:r.t,y:r.y,prev:r.prev,est:r.est}))"),by=m=>rows.find(r=>r.m===m);
  eq('February is an estimated bar',by('2026-02').est,true);
  near('February carries the yield spread (1000 * 1.02^(28/59))',by('2026-02').t,k,0.01);
  near('March (the typed balance) is exact',by('2026-03').t,1020,0.001);
  eq('the yield of March is the real difference: 1020 - 1000 (the bars do not change it)',by('2026-03').y,20);
  eq('the previous total of March is the real total of February (1000)',by('2026-03').prev,1000);
  eq('February has no typed balance, so no yield',by('2026-02').y,null);
  eq('a month after the last typed balance is not an estimate',by('2026-04')&&by('2026-04').est,false);
  // a stretch with no estimate keeps est=false
  load([{date:'2026-01-31',value:1000}]);
  ok('a single typed balance never produces an estimate',run("realSeries().every(r=>r.est===false)"));
  return res;};

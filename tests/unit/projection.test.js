/** Net worth series and compound-interest projection (domain/investments.js). */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,near,ok,res}=suite('projection');
  run("S=seed();S.tx=[];S.accounts=[{id:'a',name:'A'}];S.snaps=[{date:'2026-01-31',acc:'a',value:1000000}];S.rate=12;S.planned=10000;S.goal=1100000;");
  const p=run("project([{m:'2026-01',t:1000000}])"),m=Math.pow(1.12,1/12)-1;
  near('first month = balance x (1+i) + contribution',p.proj[0].t,1000000*(1+m)+10000,0.01);
  eq('hits the goal in month n',p.hit,run("(()=>{let b=1000000,n=0;while(b<1100000){b=b*(1+"+m+")+10000;n++;}return n;})()"));
  run("S.goal=900000;");eq('goal already reached',run("project([{m:'2026-01',t:1000000}]).hit"),0);
  // balance = last snapshot + contributions after it
  run("S.tx=[{id:1,type:'aporte',acc:'a',date:'2026-02-10',value:5000}];");
  eq('balance adds later contributions',run("balance('a','2026-02-28').v"),1005000);
  eq('contribution before snapshot ignored',run("balance('a','2026-01-31').v"),1000000);
  ok('real series has months',run("realSeries().length")>=1);
  return res;};

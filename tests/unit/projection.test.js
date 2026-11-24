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
  // month by month plan (domain/goal-projection.js)
  run("S.rate=12;S.planned=10000;S.goal=1030000;");
  const plan=run("projectionPlan({m:'2026-01',t:1000000},4)"),ml=Math.pow(1.10,1/12)-1;
  eq('months follow the start',plan.rows.map(r=>r.m),['2026-02','2026-03','2026-04','2026-05']);
  near('end = start + interest + contribution',plan.rows[0].end,1000000*(1+m)+10000,0.01);
  near('next month starts from the end of the previous',plan.rows[1].start,plan.rows[0].end,0.001);
  near('lower rate scenario uses 2 points less',plan.rows[0].low,1000000*(1+ml)+10000,0.01);
  eq('the goal month is marked once',plan.rows.map(r=>r.first),[false,true,false,false]);
  eq('reached stays true after the goal',plan.rows.map(r=>r.reached),[false,true,true,true]);
  run("S.rate=1;");eq('the lower rate never goes below zero',run("lowerRate()"),0);
  eq('table: a year, or until 3 months after the goal (max 4 years)',[run("tableMonths(null)"),run("tableMonths(0)"),run("tableMonths(5)"),run("tableMonths(20)"),run("tableMonths(60)")],[12,12,12,23,48]);
  eq('chart: a year, or up to the goal when it is within 2 years',[run("chartMonths(null)"),run("chartMonths(3)"),run("chartMonths(18)"),run("chartMonths(30)")],[12,12,19,12]);
  eq('scale fits the data when the goal is far away',run("chartScale([100000,124000],1300000)"),{max:124000*1.12,goalInside:false});
  eq('the goal is inside the scale when the data gets near it',run("chartScale([100000,1250000],1300000).goalInside"),true);
  ok('the goal line has room above it',run("chartScale([100000,1250000],1300000).max")>=1300000);
  return res;};

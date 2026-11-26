/**
 * Credit card cycle: cycleStart, nearestDueMonth, invoiceMonthOf checked by hand for one configuration, and the rule "a purchase belongs to the first invoice
 * whose closing has not passed" checked as a property over many configurations and months. Dates are calendar days (no time zone).
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('card-cycle-rules');
  const J=JSON.stringify,card=(best,due,biz)=>run(`S=seed();S.tx=[];S.card={best:${best},due:${due},biz:${biz},over:{},v3:true};true`);
  // ---- by hand: best purchase day 29, due day 7, closing moves to the next business day
  card(29,7,true);
  eq('closing of the invoice due in Nov/2026: Wed 28 Oct',run("closeDateOf('2026-11')"),'2026-10-28');
  eq('closing of the invoice due in Dec/2026: Sat 28 Nov moves to Mon 30 Nov',run("closeDateOf('2026-12')"),'2026-11-30');
  eq('the cycle of Dec/2026 starts the day after the Nov/2026 invoice closed',run("cycleStart('2026-12')"),'2026-10-29');
  eq('the cycle of Jan/2027 starts the day after Mon 30 Nov (Dec/2026 closing)',run("cycleStart('2027-01')"),'2026-12-01');
  eq('the due date is the due day of the invoice month',run("dueDateOf('2026-12')"),'2026-12-07');
  card(29,7,false);
  eq('without the business-day option the closing stays on Sat 28 Nov',run("closeDateOf('2026-12')"),'2026-11-28');
  eq('and the next cycle starts on Sun 29 Nov',run("cycleStart('2027-01')"),'2026-11-29');
  card(29,7,true);
  // ---- nearestDueMonth: the invoice whose due date is closest to the date
  eq('3 Nov is 4 days from the 7 Nov due date',run("nearestDueMonth('2026-11-03')"),'2026-11');
  eq('25 Nov is closer to 7 Dec (12 days) than to 7 Nov (18)',run("nearestDueMonth('2026-11-25')"),'2026-12');
  eq('it crosses the year: 28 Dec is closer to 7 Jan',run("nearestDueMonth('2026-12-28')"),'2027-01');
  eq('and the other way: 2 Jan is closer to 7 Jan than to 7 Dec',run("nearestDueMonth('2027-01-02')"),'2027-01');
  eq('invoiceMonthOf prefers the month the invoice was saved with',run("invoiceMonthOf({fm:'2026-05',date:'2026-11-03'})"),'2026-05');
  eq('and falls back to the nearest due month',run("invoiceMonthOf({date:'2026-11-03'})"),'2026-11');
  // ---- property: for any card setting, the days of an invoice's cycle belong to that invoice, and the day before to the previous one
  const configs=[[29,7,true],[29,7,false],[1,10,true],[31,5,false],[15,28,true],[10,1,false],[28,31,true],[2,15,true],[30,30,false]];
  const months=[];for(let i=0;i<30;i++){const y=2026+Math.floor((0+i)/12),m=(i%12)+1;months.push(`${y}-${String(m).padStart(2,'0')}`);}
  let checkedDays=0;const bad=[];
  for(const [b,d,bz] of configs){
    card(b,d,bz);
    const out=run(`(()=>{const bad=[];let days=0;for(const fm of ${J(months)}){const a=cycleStart(fm),z=closeDateOf(fm),prev=mKey(mIdx(fm)-1);
      if(a>z)bad.push('start after close '+fm);
      for(let x=a;x<=z;x=addDay(x,1)){days++;const got=dueMonth(x);if(got!==fm)bad.push(x+' -> '+got+' expected '+fm);}
      const before=addDay(a,-1);if(dueMonth(before)!==prev)bad.push('day before '+a+' -> '+dueMonth(before)+' expected '+prev);}
      return {bad:bad.slice(0,3),days};})()`);
    checkedDays+=out.days;if(out.bad.length)bad.push(`best ${b} due ${d} biz ${bz}: ${out.bad.join('; ')}`);}
  eq('every day of every cycle belongs to its invoice, for 9 card settings x 30 invoices',bad,[]);
  ok('the property really walked many days ('+checkedDays+')',checkedDays>7000);
  card(29,7,true);
  // ---- consecutive cycles do not overlap and leave no gap
  eq('each cycle starts the day after the previous closing (no gap, no overlap)',run(`(()=>{const out=[];for(const fm of ${J(months.slice(1))}){const prev=mKey(mIdx(fm)-1);if(cycleStart(fm)!==addDay(closeDateOf(prev),1))out.push(fm);}return out;})()`),[]);
  // ---- the search window of dueMonth: from the month before to 3 months ahead; if no closing in it is on or after the day, the purchase goes to the next month
  const overAll=(closings)=>run(`S=seed();S.tx=[];S.card={best:29,due:7,biz:false,over:${J(closings)},v3:true};true`);
  const past='2026-01-01',future='2027-12-31';
  const monthsOf=['2026-10','2026-11','2026-12','2027-01','2027-02','2027-03'];
  const allPast=Object.fromEntries(monthsOf.map(m=>[m,past]));
  overAll(allPast);
  eq('when no closing in the window has a later date, the purchase goes to the next month',run("dueMonth('2026-11-15')"),'2026-12');
  overAll({...allPast,'2027-02':future});
  eq('the window reaches 3 months ahead (Feb/2027 for a purchase in Nov/2026)',run("dueMonth('2026-11-15')"),'2027-02');
  overAll({...allPast,'2027-03':future});
  eq('but not 4 months ahead (Mar/2027 is out of the window: next month instead)',run("dueMonth('2026-11-15')"),'2026-12');
  overAll({...allPast,'2026-10':future});
  eq('the window starts at the previous month (Oct/2026)',run("dueMonth('2026-11-15')"),'2026-10');
  card(29,7,true);
  // ---- found by the second sample of mutations
  card(5,20,false);
  eq('closing in the same month as the due date (best day 5, due day 20): the invoice of Nov closes on Nov 4',[run("closeDateOf('2026-11')"),run("dueDateOf('2026-11')")],['2026-11-04','2026-11-20']);
  card(10,31,false);
  eq('a due day that the month does not have falls on its last day (31 in November and in February)',[run("dueDateOf('2026-11')"),run("dueDateOf('2027-02')"),run("dueDateOf('2028-02')")],['2026-11-30','2027-02-28','2028-02-29']);
  // an old setting: the program replaces it (open question 1 in critical-business-rules.md): best day 29, business days, the due day kept or 7
  run("S=seed();S.tx=[];S.card={close:10,due:15};true");
  eq('old card settings (close/due, no v3): best day 29, due day kept, business days on',run("(c=>[c.best,c.due,c.biz,c.v3])(CARD())"),[29,15,true,true]);
  run("S=seed();S.tx=[];S.card={close:10};true");
  eq('old card settings without a due day: due day 7',run("CARD().due"),7);
  card(29,7,true);
  run("S=seed();S.tx=[];S.card={best:5};true");
  eq('a card with a best day but no v3 mark is also reset (best 29, due 7, business days); open question 1',run("(c=>[c.best,c.due,c.biz])(CARD())"),[29,7,true]);
  run("S=seed();S.tx=[];S.card={best:5,due:12,over:{'2026-11':'2026-10-25'}};true");
  eq('the closing dates set by hand are kept through that reset',run("CARD().over"),{'2026-11':'2026-10-25'});
  run("S=seed();S.tx=[];S.card={best:5,due:12};true");
  eq('and are an empty object when there were none',run("CARD().over"),{});
  card(29,7,true);
  return res;};

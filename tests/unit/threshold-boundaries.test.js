/**
 * The exact edges of thresholds and ranges: savings levels, allocation targets, chart and table ranges, own-name distance, budgets, kept transfers.
 * Found by a fresh mutation sample (seed 3): none of these edges was checked. The expected values come from the rule as it is written in the code comments
 * and names (20 % and 10 % savings, 0 to 100 % targets, 3 words between first and last name), not from running the program.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,res}=suite('threshold-boundaries');
  const J=JSON.stringify;
  // ---- savings level: >= 20 % good, >= 10 % ok, below that low, below zero negative, no income: none
  eq('savings level at each edge',[null,-0.0001,0,0.0999,0.1,0.1999,0.2,0.5].map(r=>run(`savingsLevel(${J(r)})`)),['none','negative','low','low','ok','ok','good','good']);
  // ---- allocation target: each between 0 and 100, and all together not above 100
  run("S=seed();S.tx=[];true");
  eq('a target of exactly 100 % alone is accepted, 100.5 % is refused, 0 is accepted',[run("setTarget('fii',100)").value,run("setTarget('fii',100.5)").error,run("setTarget('fii',0)").value],[100,'A meta de cada tipo fica entre 0% e 100%',0]);
  // ---- how many months a chart and a table show
  eq('chart months: 12 unless the goal is reached within 24 months (then one more than that, at least 12)',[-1,0,1,11,12,24,25].map(h=>run(`chartMonths(${h})`)),[12,12,12,12,13,25,12]);
  eq('table months: 12 to 48, goal month plus 3',[-5,0,1,9,10,45,50].map(h=>run(`tableMonths(${h})`)),[12,12,12,12,13,48,48]);
  eq('chart scale with nothing or only negative values is 1; the goal is then outside',[run("chartScale([],100)"),run("chartScale([-5,-3],10)")],[{max:1,goalInside:false},{max:1,goalInside:false}]);
  eq('chart scale: 12 % above the highest value, goal inside when within 5 % of it',run("(s=>[Math.round(s.max),s.goalInside])(chartScale([100],50))"),[112,true]);
  // the top of the scale is 12 % above the highest value (112 for 100); a goal up to 5 % above that top is drawn inside and the top is raised 6 % above the goal
  eq('chart scale: goal 110 is inside (top 112, raised to 116.6); goal 120 is outside (top stays 112)',[run("(s=>[+s.max.toFixed(1),s.goalInside])(chartScale([100],110))"),run("(s=>[+s.max.toFixed(1),s.goalInside])(chartScale([100],120))")],[[116.6,true],[112,false]]);
  // a goal exactly at the edge (5 % above the top) is still drawn inside
  eq('chart scale: a goal exactly 5 % above the top is inside and raises the top',run("(top=>(s=>[s.goalInside,s.max>top])(chartScale([100],top*1.05)))(chartScale([100],1).max)"),[true,true]);
  // ---- own name: first and last name at most 3 words apart
  const m=t=>run(`mentionsOwnName(${J(t)},['Maria Souza Lima'])`);
  eq('3 words between first and last name still match, 4 do not',[m('PIX MARIA A B C LIMA'),m('PIX MARIA A B C D LIMA')],[true,false]);
  eq('a particle is not a name word: "Ana de" is not a full name, "de Souza Lima" starts at Souza',[run(`mentionsOwnName('PAGAMENTO ANA DE',['Ana de'])`),run(`mentionsOwnName('PIX SOUZA LIMA',['de Souza Lima'])`)],[false,true]);
  // ---- budgets of 1 real are still budgets
  run("S=seed();S.tx=[];initCats();setBudget('Mercado',1)");
  eq('a budget of 1 appears in the status; with 0 it is removed',[run("budgetStatus('2026-11','2026-11-20').rows.map(r=>r.group)"),(run("setBudget('Mercado',0)"),run("budgetStatus('2026-11','2026-11-20').rows.length"))],[['Mercado'],0]);
  // ---- a transfer of zero is not kept
  eq('only transfers with a date and a value above zero are kept',run(`keptTransfers([{type:'transferencia',date:'2026-11-05',value:0},{type:'transferencia',date:'2026-11-05',value:1},{type:'transferencia',date:'',value:1}]).map(d=>d.value)`),[1]);
  eq('a blank import draft has no value and is not flagged to fix a pair',run("[blankDraft().value,blankDraft().fixPair]"),[0,false]);
  return res;};

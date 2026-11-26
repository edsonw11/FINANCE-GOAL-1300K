/**
 * Goal and card settings commands (domain/settings-commands.js): what is kept, what is clamped, what falls back to a default.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('settings-commands');
  const J=JSON.stringify,fresh=()=>run("S=seed();S.tx=[];delete S.card;true");
  // ---- planned contribution
  fresh();
  eq('the planned contribution keeps its cents (owner decision Q2): 1234.56, 1234.4, 2500 and 0.4 stay as they are',[1234.56,1234.4,2500,0.4].map(v=>run(`(()=>{setPlannedContribution(${v});return S.planned;})()`)),[1234.56,1234.4,2500,0.4]);
  eq('only the third decimal is rounded away, to the cent, and float noise does not leak (183.33333, 0.1+0.2, 1234.565, 0.004)',[183.3333333,0.1+0.2,1234.565,0.004].map(v=>run(`(()=>{setPlannedContribution(${v});return S.planned;})()`)),[183.33,0.3,1234.57,0]);
  eq('NaN and text give 0, never NaN in the state',[NaN,'abc',undefined].map(v=>run(`(()=>{setPlannedContribution(${JSON.stringify(v===undefined?null:v)==='null'?'NaN':JSON.stringify(v)});return S.planned;})()`)),[0,0,0]);
  eq('the field and the "use my average" button store the same amount for the same value',[1234.56,183.33,0.07].map(v=>run(`(()=>{setGoalSettings({goal:1,rate:1,planned:${v}});const a=S.planned;setPlannedContribution(${v});return a===S.planned;})()`)),[true,true,true]);
  eq('the average of three months (100, 200, 250) is stored with cents: 183.33, not 183',run("(()=>{setPlannedContribution(avgContribution([{ap:100},{ap:200},{ap:250},{ap:999}]));return S.planned;})()"),183.33);
  // ---- goal assumptions
  fresh();run("setGoalSettings({goal:2000000,rate:10.25,planned:1500.456})");
  eq('goal, rate and planned are stored (planned in cents)',run('[S.goal,S.rate,S.planned]'),[2000000,10.25,1500.46]);
  run("setGoalSettings({goal:0,rate:-3,planned:-5})");
  eq('a goal that is not positive goes back to the default; a negative rate or contribution becomes zero',run('[S.goal,S.rate,S.planned]'),[1300000,0,0]);
  run("setGoalSettings({goal:NaN,rate:NaN,planned:NaN})");
  eq('not-a-number values are refused the same way',run('[S.goal,S.rate,S.planned]'),[1300000,0,0]);
  // ---- card settings
  fresh();
  eq('a new state gets the default card: best day 29, due day 7, business days',run("CARD()"),{best:29,due:7,biz:true,over:{},v3:true});
  eq('the setter returns what it stored',run("setCardSettings({best:10,due:20,biz:false})"),{best:10,due:20,biz:false});
  eq('and the card keeps the version mark',run("S.card.v3"),true);
  const clamp=(best,due)=>run(`(()=>{const r=setCardSettings({best:${J(best)},due:${J(due)},biz:true});return [r.best,r.due];})()`);
  eq('days are limited to 1..31',[clamp(45,99),clamp(-3,-1)],[[31,31],[1,1]]);
  eq('days are rounded',clamp(10.6,5.4),[11,5]);
  eq('an invalid or zero day falls back to the default (best 1, due 7)',[clamp(0,0),clamp(NaN,undefined),clamp('x',null)],[[1,7],[1,7],[1,7]]);
  run("S.card.over={'2026-12':'2026-11-27'}");run("setCardSettings({best:15,due:5,biz:true})");
  eq('closing dates the person set by hand survive a change of settings',run("S.card.over"),{'2026-12':'2026-11-27'});
  eq('biz is always a boolean',[run("setCardSettings({best:1,due:1,biz:0}).biz"),run("setCardSettings({best:1,due:1,biz:'yes'}).biz")],[false,true]);
  return res;};

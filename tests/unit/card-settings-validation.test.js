/**
 * The card's best purchase day and due day on READ (owner decision Q1): whole numbers from 1 to 31 are kept exactly; anything else (zero, null, text, a number outside
 * the range, a fraction, a missing field) is replaced by the default (29 and 7) without touching the rest of the settings. Old data from before the v3 mark keeps being
 * reset as before (best 29, the due day kept): that is not changed, because the old meaning of the field is not documented.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,res}=suite('card-settings-validation');
  const J=JSON.stringify;
  const read=card=>{run(`S=seed();S.tx=[];S.card=${card===undefined?'undefined':J(card)};true`);return run("(c=>({best:c.best,due:c.due,biz:c.biz,over:c.over,v3:c.v3}))(CARD())");};
  const v3=o=>({best:10,due:15,biz:false,over:{'2026-11':'2026-10-25'},v3:true,...o});
  // valid values are kept as they are, on every day of the range
  eq('a valid card is untouched',read(v3({})),{best:10,due:15,biz:false,over:{'2026-11':'2026-10-25'},v3:true});
  eq('the edges 1 and 31 are valid',[read(v3({best:1,due:31})),read(v3({best:31,due:1}))].map(c=>[c.best,c.due]),[[1,31],[31,1]]);
  // an invalid best day: default 29, due day and the rest kept
  const badBest=[['zero',0],['null',null],['text',"x"],['numeric text',"10"],['negative',-3],['32',32],['45',45],['fraction',10.5],['NaN (saved as null)',null],['boolean',true],['empty text','']];
  for(const [label,v] of badBest)eq('best day '+label+' becomes 29; due day, business days and closing dates are kept',read(v3({best:v})),{best:29,due:15,biz:false,over:{'2026-11':'2026-10-25'},v3:true});
  const badDue=[['zero',0],['null',null],['text',"x"],['numeric text',"15"],['negative',-1],['32',32],['99',99],['fraction',7.5],['empty text','']];
  for(const [label,v] of badDue)eq('due day '+label+' becomes 7; best day and the rest are kept',read(v3({due:v})),{best:10,due:7,biz:false,over:{'2026-11':'2026-10-25'},v3:true});
  eq('both invalid: both default',(c=>[c.best,c.due])(read(v3({best:0,due:'x'}))),[29,7]);
  // missing fields
  eq('a v3 card without a due day gets 7 and keeps the best day',(c=>[c.best,c.due])(read({best:12,biz:true,over:{},v3:true})),[12,7]);
  eq('no card at all: the defaults',read(undefined),{best:29,due:7,biz:true,over:{},v3:true});
  // old data (before v3): unchanged behaviour, never reinterpreted
  eq('old {close,due}: best 29, due kept',(c=>[c.best,c.due,c.biz])(read({close:10,due:15})),[29,15,true]);
  eq('old {best,due} without v3: best 29, due kept',(c=>[c.best,c.due])(read({best:5,due:12})),[29,12]);
  eq('old card with an invalid due day: 7',(c=>[c.due])(read({close:10,due:99})),[7]);
  // the dates that come out of a bad card are real dates
  run(`S=seed();S.tx=[];S.card=${J(v3({best:0,due:0,over:{},biz:true}))};true`);
  eq('closing and due dates of a card with bad days are valid dates (defaults 29 and 7)',[run("closeDateOf('2026-11')"),run("dueDateOf('2026-11')")],['2026-10-28','2026-11-07']);
  // reading never changes a good card in storage terms: same JSON
  run(`S=seed();S.tx=[];S.card=${J(v3({}))};CARD();true`);
  eq('reading a good card leaves the saved object exactly as it was',run("JSON.stringify(S.card)"),J(v3({})));
  // saving from the form still clamps
  eq('the settings form still clamps (0 -> 1, 40 -> 31, the due day default 7)',run("(()=>{setCardSettings({best:0,due:40,biz:true});return [S.card.best,S.card.due];})()"),[1,31]);
  return res;};

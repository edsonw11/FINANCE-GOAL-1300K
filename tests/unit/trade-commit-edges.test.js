/**
 * Saving the trades of a brokerage note (domain/trade-commit.js): refusals, idempotency and the contribution created by each purchase.
 * Found by the coverage report. Tickers, quantities and prices are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('trade-commit-edges');
  const J=JSON.stringify;
  const trade=o=>({ticker:'ABCD3',cls:'acao',name:'ABCD',side:'C',qty:10,price:5,fees:1,...o});
  const commit=(trades,meta)=>run(`commitTrades(${J(trades)},${J(meta)})`);
  const fresh=()=>run("S=seed();S.tx=[];S.trades=undefined;S.accounts=[{id:'nu',name:'Nubank'}];S.nid=100;_al=null;true");
  fresh();
  eq('a valid ticker is 4 letters and 1 or 2 digits, in any case',[['PETR4'],['petr4'],['ABCD11'],['PET4'],['PETR444'],['PETR'],['']].map(([t])=>run(`tradeProblems(${J({ticker:t,qty:1,price:1})}).length`)),[0,0,0,1,1,1,1]);
  eq('quantity and price must both be above zero',[[0,1],[1,0],[-1,1],[1,1]].map(([q,p])=>run(`tradeProblems(${J({ticker:'PETR4',qty:q,price:p})}).length`)),[1,1,1,0]);
  eq('a note without a date is refused, nothing saved',[commit([trade()],{}),run('S.trades')],[{error:'Data da nota inválida'},undefined]);
  eq('one bad trade refuses the whole note, with its reason',[commit([trade(),trade({qty:0})],{date:'2026-11-05'}),run('S.trades')],[{error:'Corrija: Quantidade ou preço inválido'},undefined]);
  const r=commit([trade()],{date:'2026-11-05'});
  eq('a purchase is saved, and becomes one contribution',[r,run('S.trades.length'),run("S.tx.filter(t=>t.type==='aporte').length")],[{saved:1,skipped:0,bought:1},1,1]);
  eq('the contribution is the cost with fees (10 x 5 + 1) on the note date, in an account for that kind of asset',run("(t=>[t.value,t.date,S.accounts.find(a=>a.id===t.acc).name])(S.tx.find(t=>t.type==='aporte'))"),[51,'2026-11-05','Ações']);
  eq('the account is created once and reused by the next purchase',[commit([trade({ticker:'EFGH3'})],{date:'2026-11-06'}).bought,run("S.accounts.filter(a=>a.name==='Ações').length")],[1,1]);
  eq('the same note again saves nothing (idempotent)',[commit([trade()],{date:'2026-11-05'}),run('S.trades.length')],[{saved:0,skipped:1,bought:0},2]);
  eq('two equal trades in the same note are two trades, and each is skipped on a repeat',[commit([trade({ticker:'IJKL3'}),trade({ticker:'IJKL3'})],{date:'2026-11-07'}).saved,commit([trade({ticker:'IJKL3'}),trade({ticker:'IJKL3'})],{date:'2026-11-07'}).skipped],[2,2]);
  const sold=commit([trade({side:'V',ticker:'MNOP3'})],{date:'2026-11-08'});
  eq('a sale is recorded but creates no contribution',[sold,run("S.tx.filter(t=>t.type==='aporte'&&/MNOP3/.test(t.desc)).length")],[{saved:1,skipped:0,bought:0},0]);
  eq('fees are rounded to cents and a missing fee is zero',(()=>{commit([trade({ticker:'QRST3',fees:undefined,side:'V'}),trade({ticker:'UVWX3',fees:0.126,side:'V'})],{date:'2026-11-09'});return run("S.trades.filter(t=>/QRST3|UVWX3/.test(t.ticker)).map(t=>t.fees)");})(),[0,0.13]);
  eq('a kind of asset with no label falls back to the shares account',(()=>{fresh();commit([trade({cls:'inexistente'})],{date:'2026-11-05'});return run("S.accounts.map(a=>a.name)");})(),['Nubank','Ações']);
  fresh();
  commit([trade({ticker:'AAAA3',fees:undefined}),trade({ticker:'AAAA3',fees:undefined})],{date:'2026-11-05'});
  eq('trade keys are numbered from 1 within a note (they are stored, so they must not change)',run("S.trades.map(t=>t.key.split('#')[1])"),['1','2']);
  eq('without a fee the contribution is exactly quantity x price',run("S.tx.filter(t=>t.type==='aporte').map(t=>t.value)"),[50,50]);
  eq('the contribution carries the trade key, so a second import is recognised, and nothing else carries one',run("S.tx.map(t=>t.imp)"),run("S.trades.map(t=>t.key)"));
  eq('the name of the asset is kept, and a missing one is an empty text',(()=>{fresh();commit([trade({ticker:'BBBB3'}),trade({ticker:'CCCC3',name:undefined})],{date:'2026-11-05'});return run("S.trades.map(t=>t.name)");})(),['ABCD','']);
  return res;};

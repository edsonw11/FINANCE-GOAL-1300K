/**
 * Running the rules against a given state (domain/store.js withState): the base for serving many users with the
 * same domain code. The state in force, the storage and the invoice cache never leak between states.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run,storage}=createContext(),{eq,ok,res}=suite('state-scope');
  // two users: A has a salary and a card purchase paid by an invoice, B has only a rent
  run(`globalThis.mk=(goal,tx)=>{const s=blankState();s.goal=goal;s.card={best:25,due:5,biz:true,over:{},v3:true};s.nid=50;s.tx=tx;return s;};
    globalThis.A=mk(500000,[{id:1,type:'receita',date:'2026-10-05',value:8000,cat:'Salário',fonte:'caixa'},
      {id:2,type:'despesa',date:'2026-10-10',value:300,cat:'Lazer',fonte:'cartao'},
      {id:3,type:'fatura',date:'2026-11-05',value:300,cat:'Cartão de crédito',fonte:'caixa',fm:'2026-11'}]);
    globalThis.B=mk(900000,[{id:1,type:'despesa',date:'2026-10-06',value:2000,cat:'Aluguel',fonte:'caixa'}]);
    S=blankState();S.goal=42;`);
  storage.mem['metaapp.v2']='untouched';
  // the result is the same as when the state is the global one
  const resultA=run("withState(A,()=>monthResult('2026-10')).result");
  const resultB=run("withState(B,()=>monthResult('2026-10')).result");
  eq('A: income of A',resultA.income,8000);
  eq('B: expenses of B',resultB.expenses,2000);
  eq('B does not see the income of A',resultB.income,0);
  eq('same numbers as with A as the global state',resultA,run("(()=>{const g=S;S=A;invalidateAllocation();const r=monthResult('2026-10');S=g;invalidateAllocation();return r;})()"));
  eq('the global state is back',run('S.goal'),42);
  // the invoice allocation is cached: it must not carry over from one state to the next
  eq('A: the purchase is inside the invoice',run("withState(A,()=>invoiceItems(S.tx.find(t=>t.id===3)).map(t=>t.id)).result"),[2]);
  eq('B: no open card purchase from A',run("withState(B,()=>openCard().length).result"),0);
  eq('A again: still allocated',run("withState(A,()=>openCard().length).result"),0);
  // the cache filled by the global state must not be used inside: the global invoice covers purchase 2,
  // the other state has the same purchase id 2 and no invoice at all
  run(`globalThis.G=S;S=mk(42,A.tx.map(t=>({...t})));invalidateAllocation();
    globalThis.C=mk(1,[{id:2,type:'despesa',date:'2026-10-10',value:300,cat:'Lazer',fonte:'cartao'}]);`);
  eq('global: the purchase is in the invoice (cache filled)',run('openCard().length'),0);
  eq('inside: no invoice, so the purchase is still open',run('withState(C,()=>openCard().length).result'),1);
  eq('global again: the cache is right after leaving',run('openCard().length'),0);
  run('S=G;invalidateAllocation();');
  // changes go to the given state only, and are not saved anywhere
  const changed=run(`withState(A,()=>transact(()=>{S.tx.push({id:9,type:'despesa',date:'2026-10-20',value:10,cat:'Lazer',fonte:'caixa'});}))`);
  eq('transact inside works',changed.result,true);
  eq('A received the change',run('A.tx.length'),4);
  eq('the global state did not',run('S.tx.length'),0);
  eq('nothing was written to the storage',storage.mem['metaapp.v2'],'untouched');
  // a refused command rolls back inside the scope too; the returned state is the restored copy
  const refused=run(`withState(A,()=>transact(()=>{S.tx.length=0;return {error:'não pode'};}))`);
  eq('refused command returns its error',refused.result,{error:'não pode'});
  eq('the returned state kept the records',refused.state.tx.length,4);
  // a swap of the whole state (backup import) is handed back to the caller
  const swapped=run("withState(B,()=>{replaceState(mk(7,[]));return S.goal;})");
  eq('the swap is seen inside',swapped.result,7);
  eq('the swapped state is returned',swapped.state.goal,7);
  eq('the global state is back after a swap',run('S.goal'),42);
  // errors: the previous state is put back and the error goes up
  ok('an error goes up',run("(()=>{try{withState(A,()=>{throw new Error('boom');});return false;}catch(e){return e.message==='boom';}})()"));
  eq('the global state is back after an error',run('S.goal'),42);
  // nested scopes unwind in order
  eq('nested scopes',run("withState(A,()=>[S.goal,withState(B,()=>S.goal).result,S.goal]).result"),[500000,900000,500000]);
  // misuse is refused
  ok('async fn is refused',run("(()=>{try{withState(A,async()=>1);return false;}catch(e){return /synchronous/.test(e.message);}})()"));
  eq('the global state is back after a refused async fn',run('S.goal'),42);
  ok('a missing state is refused',run("(()=>{try{withState(null,()=>1);return false;}catch(e){return e instanceof TypeError;}})()"));
  ok('an array is not a state',run("(()=>{try{withState([],()=>1);return false;}catch(e){return e instanceof TypeError;}})()"));
  ok('a missing fn is refused',run("(()=>{try{withState(A);return false;}catch(e){return e instanceof TypeError;}})()"));
  // after all of that, the global state still saves normally
  run("transact(()=>{S.goal=43;})");
  eq('the global storage works again',JSON.parse(storage.mem['metaapp.v2']).goal,43);
  return res;};

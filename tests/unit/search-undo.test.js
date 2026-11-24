/**
 * Searching every month (accents ignored) and undoing a delete exactly (including the purchases
 * an invoice payment listed).
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('search-undo');
  const tx=(id,type,date,value,extra)=>JSON.stringify({id,type,date,value,cat:'Outros',desc:'x',fonte:'caixa',...extra});
  run(`S=blankState();S.tx=[${tx(1,'despesa','2025-03-10',80,{desc:'Crédito celular',cat:'Telefone'})},${tx(2,'despesa','2026-11-02',30,{desc:'Padaria'})},${tx(3,'receita','2026-06-05',100,{desc:'Reembolso crédito'})}]`);
  eq('no search: only the month',run("filterTransactions('2026-11',{}).map(r=>r.t.id)"),[2]);
  eq('search: every month, accents and case ignored, newest first',run("filterTransactions('2026-11',{query:'CREDITO'}).map(r=>r.t.id)"),[3,1]);
  eq('every word must appear',run("filterTransactions('2026-11',{query:'credito celular'}).map(r=>r.t.id)"),[1]);
  eq('type filter still applies',run("filterTransactions('2026-11',{query:'credito',type:'receita'}).map(r=>r.t.id)"),[3]);
  eq('searchesAllMonths',[run("searchesAllMonths({query:'  '})"),run("searchesAllMonths({query:'luz'})")],[false,true]);
  // undo
  run(`S.tx.push(${tx(4,'despesa','2026-10-03',50,{fonte:'cartao',desc:'Livro'})},${tx(5,'fatura','2026-11-07',50,{items:[4]})})`);
  const before=run("JSON.stringify(S.tx)");
  run("globalThis.U=deleteTransactions([4,2])");
  eq('deleted, and the invoice no longer lists the purchase',[run("S.tx.map(t=>t.id).sort()"),run("S.tx.find(t=>t.id===5).items")],[[1,3,5],[]]);
  eq('undo puts everything back as it was',(run("restoreTransactions(U)"),run("JSON.stringify(S.tx.slice().sort((a,b)=>a.id-b.id))")),JSON.stringify(JSON.parse(before).sort((a,b)=>a.id-b.id)));
  ok('undo twice is refused (no duplicates)',!!run("restoreTransactions(U)").error);
  ok('nothing to undo',!!run("restoreTransactions(null)").error);
  return res;};

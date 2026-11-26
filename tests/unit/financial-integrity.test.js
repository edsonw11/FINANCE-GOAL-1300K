/**
 * Financial integrity across flows (seeded random data, so every run is the same): what the app shows must not drift from what it stores.
 * 1. Importing the same statement again, or a statement that overlaps a saved one, never saves a line twice.
 * 2. Money is whole cents: sums do not depend on the order, float noise is rounded at the door.
 * 3. A line the importer keeps as a transfer between own accounts changes neither income nor expenses.
 * 4. Paying a card invoice takes money out but is not an expense, and paying the whole open amount closes the invoice.
 * 5. Deleting records and undoing puts back exactly the same records.
 * 6. Pulling the same changes from the server twice gives the same state, and what came from the server is not sent back.
 * Expected values come from the rules written in the code and the docs (docs/testing/critical-business-rules.md), not from running the program.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {createContext,suite,root}=require('./harness');
module.exports=async()=>{const {run}=createContext({today:'2026-11-20'}),{eq,ok,res}=suite('financial-integrity');
  const A=await import(pathToFileURL(path.join(root,'src','sync','apply.js')).href),O=await import(pathToFileURL(path.join(root,'src','sync','outbox.js')).href);
  const J=JSON.stringify;
  let st=11;const rnd=()=>{st=(st*1664525+1013904223)>>>0;return st/4294967296;};
  const pick=a=>a[Math.floor(rnd()*a.length)],cents=n=>Math.round(n*100);
  const WORDS=['LOJA','PADARIA','MERCADO','POSTO','CINEMA','LIVRARIA','OFICINA','FEIRA'];
  const br=c=>{const n=Math.abs(c),r=String(Math.floor(n/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.'),f=String(n%100).padStart(2,'0');return (c<0?'-':'')+r+','+f;};
  const statement=(n,extra)=>{const out=[];
    for(let i=0;i<n;i++){const day=1+Math.floor(rnd()*28),month=9+Math.floor(rnd()*3),c=(rnd()<0.3?1:-1)*cents(0.01+rnd()*(rnd()<0.1?9000:500));
      out.push({date:`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,desc:`${pick(WORDS)} ${pick(WORDS)} ${i}${extra||''}`,cents:c||-1});}
    return out;};
  const csv=e=>['Data;Descrição;Valor'].concat(e.map(x=>`${x.date.slice(8)}/${x.date.slice(5,7)}/${x.date.slice(0,4)};${x.desc};${br(x.cents)}`)).join('\n');
  const fresh=()=>run("S=seed();S.tx=[];S.imports=[];S.transfers=[];S.ownNames=['Maria Souza Lima'];S.cats=undefined;delete S.catsV2;delete S.catsV3;delete S.catsV4;initCats();true");
  const importText=(name,text)=>run(`(()=>{const r=readImportFile({name:${J(name)},size:${text.length},text:${J(text)}},{today:'2026-11-20'});if(!r.ok)return {error:r.error};
    const c=commitImport(r.drafts,{fileHash:r.fileHash,fileName:${J(name)},at:'2026-11-20'});return {saved:c.saved,skipped:c.items.filter(i=>i.status==='skipped').length,failed:c.items.filter(i=>i.status==='failed').length,transfers:c.transfers};})()`);
  const snapshot=()=>run("JSON.stringify(S.tx.map(t=>[t.id,t.date,t.value,t.type,t.desc,t.imp||'']))");
  const totals=()=>run("(()=>{const o={};['2026-09','2026-10','2026-11'].forEach(m=>{const r=monthResult(m);o[m]=[r.income,r.expenses]});return o;})()");

  // ---- 1. importing again never duplicates
  const dupProblems=[];
  for(let k=0;k<25;k++){
    fresh();const e=statement(1+Math.floor(rnd()*20)),text=csv(e);
    const first=importText('a.csv',text),after1=snapshot(),n1=run('S.tx.length');
    const second=importText('a.csv',text);
    if(first.error||second.error){dupProblems.push(`#${k} refused: ${first.error||second.error}`);continue;}
    if(run('S.tx.length')!==n1||snapshot()!==after1)dupProblems.push(`#${k}: the second import of the same file changed the records (${n1} -> ${run('S.tx.length')})`);
    if(second.saved!==0)dupProblems.push(`#${k}: the second import saved ${second.saved}`);
    // a different statement that repeats some of the same lines plus new ones: only the new ones are added
    const extra=statement(1+Math.floor(rnd()*6),' NOVO'),overlap=csv(e.slice(0,Math.ceil(e.length/2)).concat(extra));
    const third=importText('b.csv',overlap);
    if(third.error){dupProblems.push(`#${k} overlap refused: ${third.error}`);continue;}
    const total=run('S.tx.length'),keys=run("S.tx.map(t=>t.date+'|'+t.desc+'|'+t.value)");
    if(total!==n1+extra.length)dupProblems.push(`#${k}: overlap added ${total-n1}, expected ${extra.length}`);
    if(new Set(keys).size!==keys.length&&e.length===new Set(e.map(x=>x.date+x.desc)).size)dupProblems.push(`#${k}: a record exists twice`);
  }
  eq('the same file twice, and an overlapping file, never save a line twice (25 seeded statements)',dupProblems.slice(0,3),[]);

  // ---- 2. money is whole cents
  const moneyProblems=[];
  for(let k=0;k<300;k++){
    const list=Array.from({length:1+Math.floor(rnd()*12)},()=>cents(rnd()*1000)/100);
    const exact=list.reduce((a,v)=>a+Math.round(v*100),0)/100,shuffled=list.slice().sort(()=>rnd()-0.5);
    if(run(`sumMoney(${J(list)})`)!==exact)moneyProblems.push(['sum',list,exact]);
    if(run(`sumMoney(${J(shuffled)})`)!==exact)moneyProblems.push(['order',shuffled]);
    const noisy=list[0]+0.1+0.2-0.3;
    if(run(`roundMoney(${noisy})`)!==Math.round((list[0])*100)/100)moneyProblems.push(['noise',noisy]);
    if(run(`roundMoney(roundMoney(${list[0]}))`)!==run(`roundMoney(${list[0]})`))moneyProblems.push(['idempotent',list[0]]);
  }
  eq('sums are exact to the cent and independent of the order; float noise (0.1+0.2-0.3) is rounded away',moneyProblems.slice(0,2),[]);
  fresh();
  eq('a value typed with float noise is stored in cents (0.30000000000000004 -> 0.3)',run("(()=>{saveTransaction({type:'despesa',date:'2026-11-05',value:0.1+0.2,cat:'Outros',desc:'noise',fonte:'caixa'});return S.tx[0].value;})()"),0.3);

  // ---- 3. an own-account transfer changes neither income nor expenses
  const trProblems=[];
  for(let k=0;k<15;k++){
    fresh();const base=statement(5+Math.floor(rnd()*8)),withTransfers=base.concat([{date:'2026-10-07',desc:'TRANSFERENCIA PIX MARIA SOUZA LIMA',cents:cents(100+rnd()*900)},{date:'2026-11-03',desc:'TRANSFERENCIA PIX MARIA SOUZA LIMA',cents:-cents(100+rnd()*900)},{date:'2026-11-04',desc:'RESGATE RDB',cents:cents(50+rnd()*50)}]);
    importText('base.csv',csv(base));const t0=J(totals()),tx0=run('S.tx.length'),bal0=run("total('2026-11-20')");
    fresh();importText('mixed.csv',csv(withTransfers));
    if(J(totals())!==t0)trProblems.push(`#${k}: income or expenses changed: ${J(totals())} vs ${t0}`);
    if(run('S.tx.length')!==tx0)trProblems.push(`#${k}: a transfer became a record (${run('S.tx.length')} vs ${tx0})`);
    if(run("total('2026-11-20')")!==bal0)trProblems.push(`#${k}: the balance changed`);
    const nTr=run('S.transfers.length');importText('mixed.csv',csv(withTransfers));
    if(run('S.transfers.length')!==nTr)trProblems.push(`#${k}: importing again kept the transfers twice`);
  }
  eq('own-account transfer lines are kept apart: income, expenses, records and balance are the same as without them, and not kept twice',trProblems.slice(0,2),[]);
  ok('the transfer lines really were kept as transfers',run('S.transfers.length')>=2);

  // ---- 4. paying a card invoice
  const payProblems=[];
  for(let k=0;k<15;k++){
    fresh();run("S.card={best:25,due:28,biz:false,over:{},v3:true};_al=null;true");
    const n=1+Math.floor(rnd()*5);let buys=0;
    for(let i=0;i<n;i++){const v=cents(10+rnd()*300)/100;buys+=Math.round(v*100);run(`saveTransaction({type:'despesa',date:'2026-0${3+Math.floor(rnd()*2)}-${String(1+Math.floor(rnd()*20)).padStart(2,'0')}',value:${v},cat:'Mercado',desc:'c${i}',fonte:'cartao'})`);}
    const expenses=run("sumMoney(S.tx.filter(t=>t.type==='despesa').map(t=>t.value))"),open=run("payableInvoices().map(f=>[f.fm,f.rest])");
    if(Math.abs(open.reduce((a,x)=>a+x[1],0)-buys/100)>0.005)payProblems.push(`#${k}: open ${open.reduce((a,x)=>a+x[1],0)} vs bought ${buys/100}`);
    for(const [fm,rest] of open){
      const all=run(`payableItems(${J(fm)}).map(t=>t.id)`);
      const plan=run(`planPayment(${J(fm)},${J(all)},'total',0)`);
      if(plan.value!==rest||!plan.full)payProblems.push(`#${k} ${fm}: plan ${J(plan)} for rest ${rest}`);
      run(`payInvoice(${J(fm)},planPayment(${J(fm)},${J(all)},'total',0),'2026-11-20')`);
      if(run("payableInvoices().some(f=>f.fm==="+J(fm)+")"))payProblems.push(`#${k} ${fm}: still open after paying all`);
    }
    if(run("sumMoney(S.tx.filter(t=>t.type==='despesa').map(t=>t.value))")!==expenses)payProblems.push(`#${k}: paying changed the expenses`);
    if(Math.abs(run("sumMoney(S.tx.filter(t=>t.type==='fatura').map(t=>t.value))")-buys/100)>0.005)payProblems.push(`#${k}: paid ${run("sumMoney(S.tx.filter(t=>t.type==='fatura').map(t=>t.value))")} vs bought ${buys/100}`);
    if(run("payableInvoices().length")!==0)payProblems.push(`#${k}: invoices left open`);
  }
  eq('the open amount equals what was bought; paying it all closes every invoice, takes out exactly that, and is not an expense',payProblems.slice(0,2),[]);

  // ---- 5. delete and undo
  const undoProblems=[];
  for(let k=0;k<20;k++){
    fresh();const e=statement(6+Math.floor(rnd()*10));importText('u.csv',csv(e));
    run("saveTransaction({type:'despesa',date:'2026-10-10',value:20,cat:'Academia',desc:'serie',fonte:'caixa',repeat:3})");
    const sorted=()=>J(run("S.tx.slice().sort((a,b)=>a.id-b.id)")),before=sorted();
    const ids=run("S.tx.filter(()=>true).map(t=>t.id)").filter(()=>rnd()<0.4);if(!ids.length)continue;
    const undo=run(`deleteTransactions(${J(ids)})`);
    if(run('S.tx.length')!==JSON.parse(before).length-ids.length)undoProblems.push(`#${k}: delete removed ${JSON.parse(before).length-run('S.tx.length')} of ${ids.length}`);
    run(`restoreTransactions(${J(undo)})`);
    if(sorted()!==before)undoProblems.push(`#${k}: undo did not restore exactly`);
  }
  eq('deleting any set of records and undoing puts back exactly the same records (also series and imported ones)',undoProblems.slice(0,2),[]);

  // ---- 6. pulling the same changes twice, no echo
  const syncProblems=[];
  const counter=()=>{let n=0;return {newId:()=>'L'+(++n),newMutationId:()=>'M'+(++n)};};
  for(let k=0;k<25;k++){
    const local={v:2,goal:1,rate:2,planned:0,nid:5,accounts:[{id:'nu',name:'N'}],snaps:[],tx:[{id:1,type:'despesa',date:'2026-10-02',value:5,cat:'Outros',desc:'a',fonte:'caixa'}]};
    const changes=Array.from({length:1+Math.floor(rnd()*6)},(_,i)=>({resource:'tx',id:'S'+k+'_'+i,version:1,deleted:false,data:{body:{id:10+Math.floor(rnd()*40)+i*50,type:'despesa',date:'2026-10-0'+(1+Math.floor(rnd()*8)),value:cents(rnd()*100)/100||1,cat:'Outros',desc:'s'+i,fonte:'caixa'},legacyKey:null}}));
    let meta={...O.emptyMeta(),userId:'u1',merged:true};
    const once=A.applyChanges(local,meta,changes),twice=A.applyChanges(once.state,once.meta,changes);
    if(J(twice.state)!==J(once.state))syncProblems.push(`#${k}: pulling twice changed the state`);
    if(twice.conflicts!==0)syncProblems.push(`#${k}: pulling the same changes twice made a conflict`);
    const echo=O.queueChanges(once.meta,once.state,counter()).outbox.filter(e=>e.resource==='tx'&&changes.some(c=>c.id===e.id));
    if(echo.length)syncProblems.push(`#${k}: ${echo.length} pulled record(s) were queued to be sent back`);
    const ids=once.state.tx.map(t=>t.id);if(new Set(ids).size!==ids.length)syncProblems.push(`#${k}: duplicate ids after pulling: ${J(ids)}`);
  }
  eq('pulling the same changes twice gives the same state, no conflict, no echo, no duplicate id (25 seeded sets)',syncProblems.slice(0,2),[]);
  return res;};

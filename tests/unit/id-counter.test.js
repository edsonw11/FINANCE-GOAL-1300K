/**
 * The id counter `nid`: it hands out the ids of transactions (numbers), accounts ('a7'), trades ('t7') and transfers ('tr7') and the series number of repeated records.
 * A counter that is missing, null, NaN, zero, negative, fractional, huge, or lower than an id already in use must never produce an id that is NaN, null or already taken
 * (a taken id makes an edit or a delete hit the wrong record, and a sync overwrite a different one). Data comes in by four doors: the browser storage,
 * a backup file, the automatic copy, and the settings document from the server. All four are checked.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {createContext,suite,root}=require('./harness');
module.exports=async()=>{const {run}=createContext({today:'2026-11-20'}),{eq,ok,res}=suite('id-counter');
  const A=await import(pathToFileURL(path.join(root,'src','sync','apply.js')).href),O=await import(pathToFileURL(path.join(root,'src','sync','outbox.js')).href);
  const J=JSON.stringify;
  const tx=(id,extra)=>({id,type:'despesa',date:'2026-11-05',value:10,cat:'Outros',desc:'x',fonte:'caixa',...extra});
  const state=over=>({v:2,goal:1,rate:1,planned:0,accounts:[],snaps:[],tx:[],...over});
  const mem=init=>`(()=>{const m=Object.assign({},${J(init)});return {m,getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=v;}};})()`;
  // three records made in a row on a state: their ids
  const idsAfter=(st)=>{run(`replaceState(${J(st)})`);return run("[1,2,3].map(()=>{saveTransaction({type:'despesa',date:'2026-11-06',value:5,cat:'Outros',desc:'n',fonte:'caixa'});return S.tx[S.tx.length-1].id;})");};
  const good=ids=>ids.every(i=>Number.isInteger(i)&&i>0)&&new Set(ids).size===ids.length;

  // ---- the plain counter
  eq('a new empty state starts at 1 and gives consecutive ids',idsAfter(state({nid:1})),[1,2,3]);
  eq('the counter keeps going from where it is',idsAfter(state({nid:50})),[50,51,52]);
  eq('a very large but safe counter still moves one at a time',idsAfter(state({nid:9007199254740000})),[9007199254740000,9007199254740001,9007199254740002]);

  // ---- door 1: a backup file (importBackup) with a bad counter
  for(const [label,nid] of [['missing',undefined],['null',null],['NaN (stored as null)',NaN],['zero',0],['negative',-4],['fractional',2.5],['text',"abc"],['empty text',''],['beyond the safe integer range',1e300],['Infinity',Infinity]]){
    const body=state({tx:[tx(7),tx(9)]});if(nid!==undefined)body.nid=nid;
    const imp=run(`importBackup(${J(JSON.parse(J(body)))})`);
    const ids=idsAfter(imp.state);
    ok('backup with a counter that is '+label+': new ids are whole, positive, unique ('+J(ids)+')',good(ids));
    ok('...and none is an id already used (7, 9)',ids.every(i=>i!==7&&i!==9));
  }
  eq('backup: a counter lower than an id already in use is lifted past it',idsAfter(run(`importBackup(${J(state({nid:3,tx:[tx(7),tx(9)]}))})`).state),[10,11,12]);
  eq('backup: a counter that is already right is left exactly as it is',run(`importBackup(${J(state({nid:40,tx:[tx(7)]}))})`).state.nid,40);

  // ---- ids of the other kinds count too: 'a12', 't7', 'tr3', and the series number of a repeated record
  const mixed=state({nid:2,accounts:[{id:'nu',name:'N'},{id:'a12',name:'x'}],trades:[{id:'t30'}],transfers:[{id:'tr41'}],tx:[tx(5,{serie:60})]});
  eq('the counter goes past the highest number of any kind (a12, t30, tr41, series 60)',run(`importBackup(${J(mixed)})`).state.nid,61);
  eq('ids that are not numbers (nu, sa) are ignored',run(`importBackup(${J(state({nid:5,accounts:[{id:'nu'},{id:'sa'}]}))})`).state.nid,5);

  // ---- door 2: browser storage (what the app reads when it opens) and the automatic copy
  const stored=J(state({tx:[tx(7),tx(9)]}));
  run(`globalThis.st=${mem({k:stored})}`);
  const opened=run("readState(st,'k',()=>blankState()).state");
  eq('storage without a counter: the counter is made from the ids in use',opened.nid,10);
  run(`globalThis.st=${mem({k:J(state({nid:null,tx:[tx(7)]}))})}`);
  eq('storage with a null counter (what NaN becomes when saved)',run("readState(st,'k',()=>blankState()).state.nid"),8);
  run(`globalThis.st=${mem({k:J(state({nid:1,tx:[tx(7)]}))})}`);
  eq('storage whose counter is behind its ids',run("readState(st,'k',()=>blankState()).state.nid"),8);
  run(`globalThis.st=${mem({'k.bak':J({day:'2026-11-19',json:stored})})}`);
  eq('the automatic copy is repaired too',run("readBackup(st,'k').state.nid"),10);
  run(`globalThis.st=${mem({k:J(state({nid:12,tx:[tx(7)]}))})}`);
  eq('good storage is returned untouched (same counter, same records)',run("(s=>[s.nid,s.tx.length])(readState(st,'k',()=>blankState()).state)"),[12,1]);

  // ---- door 3: the settings document from the server (sync)
  const meta=()=>({...O.emptyMeta(),userId:'u1',merged:true});
  const doc=body=>[{resource:'state',id:'u1',version:3,deleted:false,data:{body}}];
  const apply=(local,body)=>A.applyChanges(local,meta(),doc(body)).state;
  const settings={v:2,goal:9,rate:2,planned:0};
  eq('a settings document without a counter, local counter 1: the counter is 1, not missing',apply(state({nid:1}),settings).nid,1);
  eq('a settings document without a counter keeps the local counter',apply(state({nid:30}),settings).nid,30);
  eq('a settings document with a NaN/null counter',apply(state({nid:1}),{...settings,nid:null}).nid,1);
  eq('a settings document with a text counter',apply(state({nid:7}),{...settings,nid:'x'}).nid,7);
  eq('a settings document with a lower counter never lowers the local one',apply(state({nid:30}),{...settings,nid:4}).nid,30);
  eq('a settings document with a higher counter lifts the local one',apply(state({nid:3}),{...settings,nid:80}).nid,80);
  // the app adopts the merged state through adoptRemoteState, which lifts the counter past the ids in use
  const adopted=merged=>{run(`adoptRemoteState(${J(merged)})`);return run('S.nid');};
  eq('adopting a merged state whose counter is missing and a record at 7: the counter passes it',adopted({...apply(state({tx:[tx(7)]}),settings),nid:undefined}),8);
  eq('adopting a merged state whose counter is behind (record 7, counter 3)',adopted(apply(state({nid:3,tx:[tx(7)]}),{...settings,nid:2})),8);
  eq('adopting a good merged state keeps its counter',adopted(apply(state({nid:30,tx:[tx(7)]}),settings)),30);
  // after such a document the next ids are fine
  run(`adoptRemoteState(${J(apply(state({nid:1}),settings))})`);
  eq('ids made after a settings document without a counter are numbers',run("[1,2,3].map(()=>{saveTransaction({type:'despesa',date:'2026-11-06',value:5,cat:'Outros',desc:'n',fonte:'caixa'});return S.tx[S.tx.length-1].id;})"),[1,2,3]);

  // ---- door 4: records pulled from the server lift the counter past their keys (existing behaviour, kept)
  const pulled=A.applyChanges(state({nid:2}),meta(),[{resource:'tx',id:'S1',version:1,deleted:false,data:{body:tx(77),legacyKey:'77'}}]).state;
  eq('a pulled record 77 lifts the counter to 78',pulled.nid,78);
  const pulledNoCounter=A.applyChanges(state({}),meta(),[{resource:'tx',id:'S1',version:1,deleted:false,data:{body:tx(77),legacyKey:'77'}}]).state;
  eq('a pulled record on a state with no counter',pulledNoCounter.nid,78);

  // ---- ids really are unique and nothing is overwritten, after restart (save, then load)
  run(`replaceState(${J(state({nid:1}))})`);
  run("saveTransaction({type:'despesa',date:'2026-11-06',value:5,cat:'Outros',desc:'first',fonte:'caixa'})");
  run(`globalThis.st=${mem({})}`);
  const dumped=run("JSON.stringify(S)");
  run(`globalThis.st=${mem({k:dumped})}`);
  run("replaceState(readState(st,'k',()=>blankState()).state);saveTransaction({type:'despesa',date:'2026-11-06',value:6,cat:'Outros',desc:'second',fonte:'caixa'})");
  eq('after a restart (save, load) the next record has its own id and the first one is intact',run("S.tx.map(t=>[t.id,t.desc])"),[[1,'first'],[2,'second']]);
  // an import of a whole bad state and an edit of the record with id 7 must touch only record 7
  run(`replaceState(${J(run(`importBackup(${J(state({tx:[tx(7,{desc:'seven'}),tx(9,{desc:'nine'})]}))})`).state)})`);
  run("saveTransaction({type:'despesa',date:'2026-11-06',value:5,cat:'Outros',desc:'new',fonte:'caixa'})");
  eq('a new record does not take the id of an old one',run("S.tx.map(t=>t.desc+':'+t.id)"),['seven:7','nine:9','new:10']);
  // ---- the counter module itself, edge by edge (SAFE_TOP is the largest safe integer minus 100)
  const TOP=9007199254740891;
  eq('the number inside an id: plain, a12, t7, tr3; not numbered or too large gives 0',
    [7,'7','a12','t7','tr3','nu','sa','','a','t0','0',TOP,TOP+1,'99999999999999999999'].map(i=>run(`numberOfId(${J(i)})`)),[7,7,12,7,3,0,0,0,0,0,0,TOP,0,0]);
  const fix=st=>run(`repairIdCounter(${J(st)}).nid`);
  eq('counter edges: 1 is kept, 0 and fractions are replaced, the top value is kept, one above it is replaced, the largest safe integer is replaced',
    [1,0,0.5,TOP,TOP+1,9007199254740991].map(n=>fix(state({nid:n}))),[1,1,1,TOP,1,1]);
  eq('a counter equal to the floor is kept as it is (7 in use, counter 8)',fix(state({nid:8,tx:[tx(7)]})),8);
  eq('a counter one below the floor is lifted by exactly one',fix(state({nid:7,tx:[tx(7)]})),8);
  eq('the series number counts for transactions only (a series 90 on an account is not an id in use)',[fix(state({tx:[tx(3,{serie:90})]})),fix(state({accounts:[{id:'nu',serie:90}]}))],[91,1]);
  eq('an empty list, a missing list and a list that is not a list are fine',[fix({v:2,tx:[]}),fix({v:2}),fix({v:2,tx:5,accounts:'x'})],[1,1,1]);
  eq('an entry that is null or not an object in a list is skipped',fix(state({tx:[null,5,'x',tx(4)]})),5);
  eq('trades and transfers count',[fix(state({trades:[{id:'t8'}]})),fix(state({transfers:[{id:'tr12'}]}))],[9,13]);
  eq('something that is not a state is returned as it is',[run('repairIdCounter(null)'),run('repairIdCounter(5)'),run("repairIdCounter(undefined)")],[null,5,undefined]);
  ok('the same object is returned (not a copy)',run("(o=>repairIdCounter(o)===o)({v:2})"));
  return res;};

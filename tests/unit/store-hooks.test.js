/**
 * What the sync and the app boot rely on in domain/store.js: save listeners (onSave), adopting the state the sync merged (adoptRemoteState),
 * and the one-time "Santander was emptied" migration (migrate). Values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run,storage}=createContext(),{eq,ok,res}=suite('store-hooks');
  const J=JSON.stringify,saved=()=>JSON.parse(storage.mem['metaapp.v2']);
  // ---- onSave
  run("S=seed();S.tx=[];globalThis.__log=[];");
  run("onSave(()=>{__log.push('a:'+JSON.parse(localStorage.getItem('metaapp.v2')).goal);});onSave(()=>{throw new Error('listener bug');});onSave(()=>{__log.push('c');});");
  eq('a change is saved and every listener runs, in order, after the data is stored',[run("transact(()=>{S.goal=777;})"),run('__log')],[true,['a:777','c']]);
  ok('a listener that throws does not undo the save',saved().goal===777);
  run("__log.length=0");storage.fail=true;
  eq('a failed save does not notify the listeners',[run("transact(()=>{S.goal=1;})"),run('__log.length'),run('S.goal')],[false,0,777]);
  storage.fail=false;
  run("__log.length=0;transact(()=>({error:'no'}))");
  eq('a refused command does not notify the listeners',run('__log.length'),0);
  // ---- adoptRemoteState
  run("S=seed();S.tx=[{id:1,type:'despesa',fonte:'cartao',date:'2026-10-10',value:100,cat:'X'},{id:3,type:'fatura',fm:'2026-11',date:'2026-11-07',value:100}];invalidateAllocation();");
  eq('before: the invoice absorbs the purchase',run('alloc().map[3]'),[1]);
  run("__log.length=0;adoptRemoteState({...seed(),goal:4242,tx:[]});");
  eq('the merged state replaces the current one',[run('S.goal'),run('S.tx.length')],[4242,0]);
  eq('and is stored like any other change',[saved().goal,saved().tx.length],[4242,0]);
  eq('and the listeners are told',run('__log.length'),2);
  eq('the invoice allocation is not served from the old state',run('alloc().map'),{});
  // ---- migrate: the Santander account was emptied, its money moved to Nubank (once)
  const d=run('today()');
  const base=(extra)=>`S=seed();S.tx=[];S.accounts=${J([{id:'nu',name:'Nubank'},{id:'sa',name:'Santander'}])};${extra}`;
  run(base(`S.snaps=${J([{date:'2026-01-01',acc:'sa',value:100,est:false},{date:'2026-01-01',acc:'nu',value:50,est:false}])};`)+'migrate();');
  const nuToday=run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='nu')`),saToday=run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='sa')`);
  eq('the money moves to Nubank today (50 + 100)',nuToday.map(s=>[s.value,s.est]),[[150,false]]);
  eq('Santander is zeroed today and archived',[saToday.map(s=>s.value),run("S.accounts.find(a=>a.id==='sa').archived")],[[0],true]);
  eq('the earlier history is kept',run("S.snaps.filter(s=>s.date==='2026-01-01').length"),2);
  eq('the migration is saved',saved().accounts.find(a=>a.id==='sa').archived,true);
  const after=run('JSON.stringify(S)');run('migrate()');
  eq('running it again changes nothing (it is done once)',run('JSON.stringify(S)'),after);
  run(base(`S.snaps=${J([{date:'2026-01-01',acc:'sa',value:0,est:false},{date:'2026-01-01',acc:'nu',value:50,est:false},{date:d,acc:'nu',value:60,est:false}])};`)+'migrate();');
  eq('an empty Santander only gets archived: Nubank balance of today is untouched',[run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='nu').map(s=>s.value)`),run("S.accounts.find(a=>a.id==='sa').archived")],[[60],true]);
  run(base(`S.snaps=${J([{date:d,acc:'sa',value:100,est:false},{date:d,acc:'nu',value:50,est:true}])};`)+'migrate();');
  eq('snapshots already dated today are replaced, not added to',[run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='nu').map(s=>[s.value,s.est])`),run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='sa').length`)],[[[150,false]],1]);
  run(base('S.snaps=[];')+"S.accounts=S.accounts.filter(a=>a.id!=='sa');");const noSa=run('JSON.stringify(S)');run('migrate()');
  eq('without a Santander account nothing happens',run('JSON.stringify(S)'),noSa);
  run(base('S.snaps=[];')+"S.accounts=S.accounts.filter(a=>a.id!=='nu');");const noNu=run('JSON.stringify(S)');run('migrate()');
  eq('without a Nubank account to receive the money nothing happens',run('JSON.stringify(S)'),noNu);
  // owner decision Q4: the move runs once, and the "done" mark is stored in the state
  run(base(`S.snaps=${J([{date:'2026-01-01',acc:'sa',value:100,est:false},{date:'2026-01-01',acc:'nu',value:50,est:false}])};`)+'migrate();');
  eq('first run: the mark is set and stored',[run('S.migrated'),saved().migrated],[{sa:true},{sa:true}]);
  run("S.accounts.find(a=>a.id==='sa').archived=false;");const unarchived=run('JSON.stringify(S)');run('migrate()');
  eq('repeated run with the mark: nothing changes even if the account is back unarchived',run('JSON.stringify(S)'),unarchived);
  run(base(`S.snaps=${J([{date:'2026-01-01',acc:'sa',value:100,est:false},{date:'2026-01-01',acc:'nu',value:50,est:false}])};S.migrated={sa:true};`)+'migrate();');
  eq('a backup that already carries the mark is not migrated again (Nubank keeps 50, no snapshot today)',[run(`S.snaps.filter(s=>s.date==='${d}').length`),run("S.accounts.find(a=>a.id==='sa').archived")],[0,undefined]);
  run(base(`S.snaps=${J([{date:'2026-01-01',acc:'sa',value:100,est:false},{date:'2026-01-01',acc:'nu',value:50,est:false}])};`)+'migrate();');
  eq('an old backup (no mark, Santander still open) is migrated: 100 moves to Nubank',[run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='nu').map(s=>s.value)`),run('S.migrated')],[[150],{sa:true}]);
  run(base('S.snaps=[];')+"S.accounts.find(a=>a.id==='sa').archived=true;");const snapsBefore=run('JSON.stringify(S.snaps)');run('migrate()');
  eq('an account archived by an earlier version only gets the mark, with no new snapshots',[run('JSON.stringify(S.snaps)'),run('S.migrated')],[snapsBefore,{sa:true}]);
  run(base('S.snaps=[];')+"S.accounts=S.accounts.filter(a=>a.id!=='sa');");run('migrate()');
  eq('a state without Santander gets no mark and no change',run('S.migrated'),undefined);
  // the Santander balance is moved only above half a cent; at or below it the account is just archived
  run(base(`S.snaps=${J([{date:'2026-01-01',acc:'sa',value:0.005,est:false},{date:'2026-01-01',acc:'nu',value:50,est:false}])};`)+'migrate();');
  eq('a Santander balance of exactly 0.005 is not moved to Nubank (but the account is archived)',[run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='nu').length`),run("S.accounts.find(a=>a.id==='sa').archived")],[0,true]);
  run(base(`S.snaps=${J([{date:'2026-01-01',acc:'sa',value:0.01,est:false},{date:'2026-01-01',acc:'nu',value:50,est:false}])};`)+'migrate();');
  eq('a Santander balance of 0.01 is moved to Nubank',run(`S.snaps.filter(s=>s.date==='${d}'&&s.acc==='nu').map(s=>s.value)`),[50.01]);
  return res;};

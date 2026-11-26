/**
 * Applying what the server reports to the local state: inserts, updates, deletes, what waits to be sent, first merge, clashes.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
const load=f=>import(pathToFileURL(path.join(root,'src','sync',f)).href);
module.exports=async()=>{const {eq,res}=suite('sync-apply');
  const O=await load('outbox.js'),A=await load('apply.js');
  const counter=()=>{let n=0;return {newId:()=>'L'+(++n),newMutationId:()=>'M'+(++n)};};
  const put=(resource,id,body,version=1)=>({resource,id,version,deleted:false,data:{body,legacyKey:resource==='snap'?null:String(body.id)}});
  const del=(resource,id,version=2)=>({resource,id,version,deleted:true,data:null});
  const synced=(state,userId='u1')=>{let m={...O.emptyMeta(),userId,merged:true};m=O.queueChanges(m,state,counter());return {...m,outbox:[]};};
  const base=()=>({v:2,goal:1,rate:2,planned:0,nid:3,accounts:[{id:'nu',name:'Nubank'}],snaps:[],tx:[{id:1,type:'despesa',date:'2026-10-02',value:5}]});

  // plain changes
  let m=synced(base()),r=A.applyChanges(base(),m,[put('tx','S2',{id:2,type:'receita',date:'2026-10-03',value:7})]);
  eq('a new record from the server is added to its list',r.state.tx.map(t=>t.id),[1,2]);
  eq('and knows its server id',r.meta.ids['tx:2'],'S2');
  eq('applying does not touch its inputs',[base().tx.length,m.ids['tx:2']],[1,undefined]);
  eq('what the server sent is not sent back',O.queueChanges(r.meta,r.state,counter()).outbox.length,0);
  r=A.applyChanges(base(),m,[put('tx',m.ids['tx:1'],{id:1,type:'despesa',date:'2026-10-02',value:99})]);
  eq('a changed record replaces the local one',r.state.tx,[{id:1,type:'despesa',date:'2026-10-02',value:99}]);
  eq('without echo',O.queueChanges(r.meta,r.state,counter()).outbox.length,0);
  r=A.applyChanges(base(),m,[del('tx',m.ids['tx:1'])]);
  eq('a delete removes the record',r.state.tx,[]);
  eq('and the bookkeeping for it',[r.meta.ids['tx:1'],r.meta.known['tx:1']],[undefined,undefined]);
  eq('without echo (no delete sent back)',O.queueChanges(r.meta,r.state,counter()).outbox.length,0);
  eq('a delete of something unknown is ignored',A.applyChanges(base(),m,[del('tx','nobody')]).state,base());
  eq('an unknown resource is ignored',A.applyChanges(base(),m,[put('mystery','x',{id:1})]).state,base());
  eq('a record with no key is ignored',A.applyChanges(base(),m,[put('tx','x',{type:'y'})]).state,base());
  r=A.applyChanges({v:2},m,[put('trade','T1',{id:'t3',ticker:'X'})]);
  eq('a list that did not exist is created',r.state.trades,[{id:'t3',ticker:'X'}]);
  r=A.applyChanges(base(),m,[put('snap','B1',{date:'2026-10-01',acc:'nu',value:3})]);
  eq('a balance is added and found again by day and account',r.meta.ids['snap:2026-10-01|nu'],'B1');
  r=A.applyChanges(r.state,r.meta,[put('snap','B1',{date:'2026-10-01',acc:'nu',value:4},3)]);
  eq('and updated in place',r.state.snaps,[{date:'2026-10-01',acc:'nu',value:4}]);

  // the counter
  r=A.applyChanges(base(),m,[put('tx','S9',{id:40,type:'despesa',date:'2026-10-03',value:1}),put('account','A9',{id:'a41',name:'X'}),put('transfer','R9',{id:'tr42'})]);
  eq('the id counter jumps past every number the server already has',r.state.nid,43);
  r=A.applyChanges({...base(),nid:100},m,[put('tx','S9',{id:40,type:'despesa',date:'2026-10-03',value:1})]);
  eq('and never goes down',r.state.nid,100);
  r=A.applyChanges(base(),m,[put('account','A8',{id:'nu2',name:'X'})]);
  eq('a key that is not a number leaves it alone',r.state.nid,3);

  // waiting local work
  let local=base();local.tx[0].value=77;
  let w=O.queueChanges(synced(base()),local,counter());
  r=A.applyChanges(local,w,[put('tx',w.ids['tx:1'],{id:1,type:'despesa',date:'2026-10-02',value:1})]);
  eq('a local edit that has not been sent wins over the server version',r.state.tx[0].value,77);
  eq('and is still waiting',r.meta.outbox.length,1);
  r=A.applyChanges(local,w,[del('tx',w.ids['tx:1'])]);
  eq('a delete wins over a waiting edit',[r.state.tx.length,r.meta.outbox.filter(e=>e.resource==='tx').length],[0,0]);
  let s2=base();s2.goal=50;
  w=O.queueChanges(synced(base()),s2,counter());
  r=A.applyChanges(s2,w,[{resource:'state',id:'u1',version:5,deleted:false,data:{body:{v:2,goal:9,rate:2,planned:0,nid:3,_lists:['accounts','snaps','tx']}}}]);
  eq('settings waiting to be sent win over the server settings',r.state.goal,50);
  r=A.applyChanges(base(),synced(base()),[{resource:'state',id:'u1',version:5,deleted:false,data:{body:{v:2,goal:9,rate:2,planned:0,nid:3,extra:true,_lists:['accounts','snaps','tx']}}}]);
  eq('otherwise the server settings replace the local ones, lists untouched',[r.state.goal,r.state.extra,r.state.tx.length],[9,true,1]);
  eq('settings from the server are not sent back',O.queueChanges(r.meta,r.state,counter()).outbox.length,0);
  r=A.applyChanges(base(),synced(base()),[{resource:'state',id:'u1',version:5,deleted:false,data:{body:{v:2,goal:9,_lists:['accounts','trades']}}}]);
  eq('lists the server settings say exist are created, not dropped',Array.isArray(r.state.trades),true);

  // first merge
  const ids=counter();
  let first={...O.emptyMeta(),userId:'u1'};first=O.queueChanges(first,base(),ids);
  eq('before the first merge everything local is waiting',first.outbox.length,3);
  const same={id:1,type:'despesa',date:'2026-10-02',value:5};
  r=A.applyChanges(base(),first,[put('tx','SRV1',same)]);
  eq('first merge: the same record adopts the server id, no duplicate',[r.state.tx.length,r.meta.ids['tx:1']],[1,'SRV1']);
  eq('and nothing is sent for it',r.meta.outbox.some(e=>e.resource==='tx'),false);
  r=A.applyChanges(base(),first,[put('tx','SRV1',{...same,value:6})]);
  eq('first merge: same key, different content keeps the local one and sends it under the server id',[r.state.tx[0].value,r.meta.outbox.find(e=>e.resource==='tx').id],[5,'SRV1']);
  eq('first merge: no clash is recorded',r.meta.review,[]);
  r=A.applyChanges({v:2,goal:1,rate:2,planned:0,nid:1,accounts:[],snaps:[],tx:[]},O.queueChanges({...O.emptyMeta(),userId:'u1'},{v:2,goal:1,rate:2,planned:0,nid:1,accounts:[],snaps:[],tx:[]},counter()),[{resource:'state',id:'u1',version:5,deleted:false,data:{body:{v:2,goal:777,rate:2,planned:0,nid:9,_lists:['accounts','snaps','tx']}}}]);
  eq('first merge: a new blank device takes the account settings and never overwrites them',[r.state.goal,r.meta.outbox.some(e=>e.resource==='state')],[777,false]);
  eq('first merge: the counter is the larger one',r.state.nid,9);

  // later clash
  let later=synced(base());later.ids['tx:1']='LOCAL';
  later.outbox=[];
  r=A.applyChanges(base(),later,[put('tx','OTHER',{id:1,type:'receita',date:'2026-10-09',value:1})]);
  eq('after the first merge the same key under another id is a clash: kept for review, nothing overwritten',[r.state.tx[0].type,r.meta.review.length,r.conflicts],['despesa',1,1]);
  eq('the clash keeps what the server sent',r.meta.review[0].body.type,'receita');
  // ---- the settings document and the id counter: it only goes up, and never below 1
  const settingsDoc=body=>[{resource:'state',id:'u1',version:9,deleted:false,data:{body:{v:2,goal:9,rate:2,planned:0,_lists:['accounts','snaps','tx'],...body}}}];
  const withCounter=n=>({...base(),nid:n});
  eq('settings from the server without a counter keep the local counter (7)',A.applyChanges(withCounter(7),synced(withCounter(7)),settingsDoc({})).state.nid,7);
  eq('also when the local counter is 2',A.applyChanges(withCounter(2),synced(withCounter(2)),settingsDoc({})).state.nid,2);
  eq('a server counter above the local one wins',A.applyChanges(withCounter(3),synced(withCounter(3)),settingsDoc({nid:50})).state.nid,50);
  eq('a server counter below the local one does not lower it',A.applyChanges(withCounter(30),synced(withCounter(30)),settingsDoc({nid:4})).state.nid,30);
  eq('a counter of 0 from the server is raised to 1',A.applyChanges(withCounter(1),synced(withCounter(1)),settingsDoc({nid:0})).state.nid,1);
  // ---- an entry waiting at index 0 of the outbox is found too
  const txEntryFirst={...first,outbox:[...first.outbox.filter(e=>e.resource==='tx'),...first.outbox.filter(e=>e.resource!=='tx')]};
  r=A.applyChanges(base(),txEntryFirst,[put('tx','SRV1',same)]);
  eq('first merge with the record entry at index 0: the identical waiting entry is dropped',[r.meta.outbox.some(e=>e.resource==='tx'),r.meta.known['tx:1']!==undefined,r.meta.outbox.length],[false,true,first.outbox.length-1]);
  const withReview=synced(base());withReview.ids['tx:1']='LOCAL';withReview.outbox=[];withReview.review=[{reason:'key_conflict',ref:'tx:9',resource:'tx',id:'OLD',body:{}}];
  r=A.applyChanges(base(),withReview,[put('tx','OTHER',{id:1,type:'receita',date:'2026-10-09',value:1})]);
  eq('the number of conflicts counts only the new ones, not the ones already waiting for review',[r.meta.review.length,r.conflicts],[2,1]);
  return res;};

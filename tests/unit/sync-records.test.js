/**
 * Sync bookkeeping: how the state maps to records, and what gets queued when it changes.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
const load=f=>import(pathToFileURL(path.join(root,'src','sync',f)).href);
module.exports=async()=>{const {eq,ok,res}=suite('sync-records');
  const R=await load('records.js'),O=await load('outbox.js');
  const base=()=>({v:2,goal:1300000,rate:12.5,planned:0,nid:5,accounts:[{id:'nu',name:'Nubank'}],snaps:[{date:'2026-10-01',acc:'nu',value:10}],tx:[{id:1,type:'despesa',date:'2026-10-02',value:5,cat:'x'}]});
  const counter=()=>{let n=0;return {newId:()=>'id'+(++n),newMutationId:()=>'m'+(++n)};};

  // keys and fingerprints
  eq('tx key is its id as text',R.keyOf('tx',{id:12}),'12');
  eq('account key is its id',R.keyOf('account',{id:'nu'}),'nu');
  eq('import key is its hash',R.keyOf('import',{hash:'abc'}),'abc');
  eq('a balance is keyed by day and account',R.keyOf('snap',{date:'2026-10-01',acc:'nu'}),'2026-10-01|nu');
  eq('a balance has no legacy key on the server',R.legacyKeyOf('snap',{date:'d',acc:'a'}),null);
  eq('no id means no key',R.keyOf('tx',{type:'x'}),null);
  eq('garbage has no key',[R.keyOf('tx',null),R.keyOf('tx',5),R.keyOf('snap',{date:'d'})],[null,null,null]);
  eq('the same content in another key order has the same fingerprint',R.fingerprint({a:1,b:{c:2,d:3}}),R.fingerprint({b:{d:3,c:2},a:1}));
  ok('a changed value changes the fingerprint',R.fingerprint({a:1})!==R.fingerprint({a:2}));
  ok('a changed key changes the fingerprint',R.fingerprint({a:1})!==R.fingerprint({b:1}));
  ok('a nested change changes the fingerprint',R.fingerprint({a:[1,2,{b:1}]})!==R.fingerprint({a:[1,2,{b:2}]}));
  ok('order inside a list matters',R.fingerprint([1,2])!==R.fingerprint([2,1]));
  eq('undefined fields do not count',R.fingerprint({a:1,b:undefined}),R.fingerprint({a:1}));
  ok('null is not the same as missing',R.fingerprint({a:null})!==R.fingerprint({}));
  ok('1 is not "1"',R.fingerprint({a:1})!==R.fingerprint({a:'1'}));

  // split
  const sp=R.splitState(base());
  eq('records of every list, by ref',[...sp.records.keys()].sort(),['account:nu','snap:2026-10-01|nu','tx:1']);
  eq('settings hold everything except the lists, and say which lists exist',sp.settings,{v:2,goal:1300000,rate:12.5,planned:0,nid:5,_lists:['accounts','snaps','tx']});
  const sparse=R.splitState({v:2,goal:1,tx:[]});
  eq('an absent list is not an empty one',sparse.settings._lists,['tx']);
  eq('a record with no key is skipped and counted',R.splitState({tx:[{type:'x'},{id:2}]}).skipped,1);
  eq('the last of two records with the same key is kept',R.splitState({tx:[{id:1,v:'a'},{id:1,v:'b'}]}).records.get('tx:1').body.v,'b');
  ok('a list name that is a prototype name is not a list',R.splitState({constructor:[{id:1}],toString:[]}).records.size===0);
  eq('settings of such names are kept as settings',Object.keys(R.splitState({constructor:5}).settings).includes('constructor'),true);

  // queue
  let m=O.emptyMeta();m.userId='u1';
  const ids=counter();
  m=O.queueChanges(m,base(),ids);
  eq('first capture: three records and the settings',m.outbox.map(e=>e.resource).sort(),['account','snap','state','tx']);
  eq('every entry is a put, not yet attempted',m.outbox.every(e=>e.op==='put'&&e.attempted===false),true);
  eq('settings go under the person id',m.outbox.find(e=>e.resource==='state').id,'u1');
  eq('a put carries the body and the legacy key',m.outbox.find(e=>e.resource==='tx').data,{body:base().tx[0],legacyKey:'1'});
  eq('a balance goes without a legacy key',m.outbox.find(e=>e.resource==='snap').data.legacyKey,null);
  eq('every entry has its own mutation id',new Set(m.outbox.map(e=>e.mutationId)).size,4);
  const again=O.queueChanges(m,base(),counter());
  eq('capturing an unchanged state queues nothing',again.outbox.length,4);
  eq('and does not change the input meta',m.outbox.length,4);

  let st=base();st.tx[0].value=9;
  const edited=O.queueChanges(m,st,counter());
  eq('editing a record that was never sent updates its waiting entry',[edited.outbox.length,edited.outbox.find(e=>e.resource==='tx').data.body.value],[4,9]);
  st=base();st.tx=[];
  const cancelled=O.queueChanges(m,st,counter());
  eq('deleting a record that was never sent cancels it',cancelled.outbox.some(e=>e.resource==='tx'),false);
  eq('and forgets its id',Object.keys(cancelled.ids).includes('tx:1'),false);

  // after a send started
  const sent={...m,outbox:m.outbox.map(e=>({...e,attempted:true}))};
  st=base();st.tx[0].value=9;
  const edit2=O.queueChanges(sent,st,counter());
  eq('editing something already sent is a new entry (the server may have the old one)',edit2.outbox.length,5);
  eq('the new entry reuses the same record id',edit2.outbox[4].id,sent.outbox.find(e=>e.resource==='tx').id);
  st=base();st.tx=[];
  const del=O.queueChanges(sent,st,counter());
  const d=del.outbox.find(e=>e.op==='delete');
  eq('deleting something already sent queues a delete for its id',[d.resource,d.id],['tx',sent.outbox.find(e=>e.resource==='tx').id]);
  eq('a delete carries no data',d.data,undefined);
  const back=O.queueChanges(del,base(),counter());
  ok('creating the same key again takes a new id (a deleted id never comes back)',back.ids['tx:1']!==sent.ids['tx:1']);

  // settings
  const noUser=O.queueChanges(O.emptyMeta(),base(),counter());
  eq('without a signed-in person the settings wait (no id to send them under)',noUser.outbox.some(e=>e.resource==='state'),false);
  st=base();st.goal=5;
  const set2=O.queueChanges(sent,st,counter());
  eq('a changed setting queues the settings',set2.outbox.filter(e=>e.resource==='state').length,2);
  const set3=O.queueChanges(set2,{...st,rate:7},counter());
  eq('a second change before sending updates the waiting settings entry',[set3.outbox.filter(e=>e.resource==='state').length,set3.outbox[set3.outbox.length-1].data.body.rate],[2,7]);
  eq('adding a list shows in the mark',O.queueChanges(sent,{...base(),trades:[]},counter()).outbox.find(e=>e.resource==='state'&&!e.attempted).data.body._lists.includes('trades'),true);

  // size
  const big=base();big.tx=Array.from({length:5000},(_,i)=>({id:i+1,type:'despesa',date:'2026-01-01',value:i}));
  const t0=Date.now(),bigMeta=O.queueChanges(O.emptyMeta(),big,counter());
  eq('5000 records are queued',bigMeta.outbox.filter(e=>e.resource==='tx').length,5000);
  ok('and a second capture of the same state is fast',(()=>{const t=Date.now();O.queueChanges(bigMeta,big,counter());return Date.now()-t<1000;})());
  ok('the first capture of 5000 records is fast',Date.now()-t0<3000);
  return res;};

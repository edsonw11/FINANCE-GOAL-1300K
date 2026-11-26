/**
 * Whole sync runs against a small in-memory server: two devices, no network, retries, rejections, big outboxes.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
const {createServer}=require('./sync-fake-server');
const load=f=>import(pathToFileURL(path.join(root,'src','sync',f)).href);
module.exports=async()=>{const {eq,res}=suite('sync-runner');
  const Run=await load('runner.js'),Outbox=await load('outbox.js');
  let seq=0;
  const mem=()=>{const o={};return {getItem:k=>o[k]??null,setItem:(k,v)=>{o[k]=String(v);},o};};
  const device=(server,user='u1',initial)=>{
    const d={state:initial||{v:2,goal:1,rate:2,planned:0,nid:1,accounts:[],snaps:[],tx:[]},storage:mem(),clock:0};
    d.sync=Run.createSync({api:server.api,store:Run.metaStore(d.storage,'meta'),getState:()=>d.state,setState:s=>{d.state=s;},newId:()=>'id'+(++seq),newMutationId:()=>'mut'+(++seq),now:()=>++d.clock});
    d.sync.bind(user);
    d.add=t=>{d.state={...d.state,tx:[...d.state.tx,{type:'despesa',date:'2026-10-02',value:1,...t,id:d.state.nid},],nid:d.state.nid+1};};
    return d;
  };
  const txIds=d=>d.state.tx.map(t=>t.id).sort((a,b)=>a-b);

  // one device
  let srv=createServer(),a=device(srv);
  a.add({value:10});a.add({value:20});
  let r=await a.sync.run();
  eq('a run sends everything and says so',[r.ok,r.pending],[true,0]);
  eq('the server has both records',srv.live('tx').length,2);
  eq('the settings reached the server',srv.state.body.nid,3);
  eq('the visible count leaves out the settings entry',(()=>{const x=device(createServer());x.add({value:1});x.sync.capture();const st=x.sync.status();return [st.pending,st.pendingItems];})(),[2,1]);
  eq('status after a run',[a.sync.status().pending,a.sync.status().lastSyncAt!==null],[0,true]);
  const pushes=srv.pushes;await a.sync.run();
  eq('a run with nothing to do sends nothing',srv.pushes,pushes);

  // second device
  let b=device(srv);await b.sync.run();
  eq('another device gets the same records',txIds(b),[1,2]);
  eq('and the same settings, counter included',b.state.nid,3);
  eq('and has nothing to send back',b.sync.status().pending,0);
  b.add({value:30});await b.sync.run();await a.sync.run();
  eq('what one device adds reaches the other',txIds(a),[1,2,3]);
  a.state={...a.state,tx:a.state.tx.filter(t=>t.id!==2)};await a.sync.run();await b.sync.run();
  eq('a delete reaches the other device',txIds(b),[1,3]);
  eq('and the server keeps it as a tombstone, not a live row',srv.live('tx').length,2);
  a.state={...a.state,tx:a.state.tx.map(t=>t.id===1?{...t,value:999}:t)};await a.sync.run();await b.sync.run();
  eq('an edit reaches the other device',b.state.tx.find(t=>t.id===1).value,999);

  // offline and failures
  srv.down=true;a.add({value:5});r=await a.sync.run();
  eq('offline: the run fails and says why',[r.ok,r.reason],[false,'offline']);
  eq('offline: the outbox is kept',a.sync.status().pending>0,true);
  srv.down=false;srv.unauthorized=true;r=await a.sync.run();
  eq('login expired: says so and keeps everything',[r.ok,r.reason,a.sync.status().pending>0],[false,'unauthorized',true]);
  srv.unauthorized=false;r=await a.sync.run();
  eq('when it works again everything goes',[r.ok,a.sync.status().pending],[true,0]);
  eq('without duplicates',srv.live('tx').length,3);

  // crash after the server got it: the same entry is sent again and changes nothing
  a.add({value:6});
  const real=srv.api.push;let lost=true;
  srv.api.push=async m=>{const out=await real(m);if(lost){lost=false;throw {kind:'offline'};}return out;};
  r=await a.sync.run();
  eq('the answer is lost on the way back: the run fails',r.ok,false);
  eq('the entry is still waiting',a.sync.status().pending>0,true);
  r=await a.sync.run();
  eq('the retry works and the server has the record once',[r.ok,srv.live('tx').length],[true,4]);
  srv.api.push=real;

  // rejection
  srv=createServer();a=device(srv);a.add({value:1});a.add({value:2});a.add({value:3});
  srv.reject=m=>m.resource==='tx'&&m.data.body.value===2?'invalid_data':null;
  await a.sync.run();
  eq('a rejected entry goes to review with its data, the others are sent',[srv.live('tx').length,a.sync.status().review],[2,1]);
  eq('and the outbox is empty, nothing loops',a.sync.status().pending,0);
  eq('the local data is untouched',txIds(a),[1,2,3]);
  eq('the review item keeps what was sent',Run.metaStore(a.storage,'meta').load().review[0].data.body.value,2);
  eq('reviewItems hands the screen what was refused, with the reason',a.sync.reviewItems().map(i=>[i.reason,i.resource,i.op,i.data.body.value]),[['invalid_data','tx','put',2]]);
  a.sync.clearReview();
  eq('clearReview empties the list and nothing else',[a.sync.reviewItems().length,a.sync.status().review,txIds(a),srv.live('tx').length],[0,0,[1,2,3],2]);
  eq('a cleared review stays cleared after the next run',(await a.sync.run(),a.sync.reviewItems().length),0);
  eq('pendingCount is the number of waiting entries',(()=>{const x=device(createServer());x.add({value:1});x.sync.capture();return [x.sync.status().pending,Outbox.pendingCount({outbox:[{},{},{}]}),Outbox.pendingCount({outbox:[]})];})(),[2,3,0]);

  // batches
  srv=createServer();a=device(srv);
  for(let i=0;i<250;i++)a.add({value:i});
  r=await a.sync.run();
  eq('250 records go in batches and all arrive',[r.ok,srv.live('tx').length],[true,250]);
  eq('in three pushes (plus none for settings extra)',srv.pushes>=3&&srv.pushes<=4,true);
  b=device(srv);await b.sync.run();
  eq('and a second device pulls them all',b.state.tx.length,250);

  // the same history on two devices (both imported the same file)
  srv=createServer();
  const history=()=>({v:2,goal:1,rate:2,planned:0,nid:4,accounts:[{id:'nu',name:'N'}],snaps:[{date:'2026-10-01',acc:'nu',value:1}],tx:[{id:1,type:'despesa',date:'2026-10-02',value:1},{id:2,type:'despesa',date:'2026-10-02',value:2},{id:3,type:'despesa',date:'2026-10-02',value:3}]});
  a=device(srv,'u1',history());b=device(srv,'u1',history());
  await a.sync.run();await b.sync.run();await a.sync.run();
  eq('the same data on two devices is not doubled on the server',[srv.live('tx').length,srv.live('account').length,srv.live('snap').length],[3,1,1]);
  eq('nor on the devices',[a.state.tx.length,b.state.tx.length],[3,3]);
  eq('and nothing waits',[a.sync.status().pending,b.sync.status().pending,a.sync.status().review,b.sync.status().review],[0,0,0,0]);

  // a clash: both devices made a record with the same number while offline
  srv=createServer();a=device(srv);b=device(srv);await a.sync.run();await b.sync.run();
  a.add({value:111});b.add({value:222});
  await a.sync.run();await b.sync.run();
  eq('two offline devices using the same number: the second goes to review, nothing is overwritten',[b.sync.status().review>0||a.sync.status().review>0,srv.live('tx').length],[true,1]);
  eq('the first device keeps its record',a.state.tx.find(t=>t.id===1).value,111);
  eq('the second device keeps its own record too (the person decides)',b.state.tx.find(t=>t.id===1).value,222);

  // the account
  srv=createServer();a=device(srv,'u1');
  eq('another person on the same device is refused',a.sync.bind('u2'),{ok:false,reason:'other_account'});
  eq('the same person is accepted',a.sync.bind('u1'),{ok:true});
  const anon=Run.createSync({api:srv.api,store:Run.metaStore(mem(),'m'),getState:()=>a.state,setState:()=>{},newId:()=>'x',newMutationId:()=>'y',now:()=>1});
  eq('without a signed-in person nothing is sent',[(await anon.run()).reason,srv.pushes],['not_signed_in',0]);

  // two runs at once
  srv=createServer();a=device(srv);a.add({value:1});
  const [r1,r2]=await Promise.all([a.sync.run(),a.sync.run()]);
  eq('two runs at the same time are one run',[r1===r2,srv.live('tx').length,srv.pushes],[true,1,1]);

  // an edit made while a send is in flight is not lost
  srv=createServer();a=device(srv);a.add({value:1});await a.sync.run();
  a.state={...a.state,tx:a.state.tx.map(t=>({...t,value:2}))};
  const slow=srv.api.push;let edited=false;
  srv.api.push=async m=>{const out=await slow(m);if(!edited){edited=true;a.state={...a.state,tx:a.state.tx.map(t=>({...t,value:3}))};a.sync.capture();}return out;};
  await a.sync.run();srv.api.push=slow;await a.sync.run();
  eq('an edit made while a send is in flight reaches the server',srv.live('tx')[0].body.value,3);

  // an answer that settles nothing
  srv=createServer();a=device(srv);a.add({value:1});
  srv.api.push=async()=>({results:[]});
  r=await a.sync.run();
  eq('a server answer that settles nothing stops the run and keeps the outbox',[r.ok,r.reason,a.sync.status().pending>0],[false,'server',true]);

  // state recovers from storage
  a.add({value:2});await a.sync.run();
  const again=Run.createSync({api:srv.api,store:Run.metaStore(a.storage,'meta'),getState:()=>a.state,setState:s=>{a.state=s;},newId:()=>'z'+(++seq),newMutationId:()=>'zm'+(++seq),now:()=>1});
  const before=srv.pushes;await again.run();
  eq('after the app is closed and reopened nothing is sent twice',srv.pushes,before);
  a.storage.setItem('meta','{broken');
  eq('a broken bookkeeping falls back to empty (and the next run starts a clean first merge)',Run.metaStore(a.storage,'meta').load().outbox,[]);
  return res;};

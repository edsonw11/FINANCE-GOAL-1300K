/**
 * The API client of the sync: what it sends (verb, path, CSRF header, cookies) and how every failure becomes one of the three kinds the sync understands.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,res}=suite('api-client');
  const {createApiClient,loginUrl}=await import(pathToFileURL(path.join(root,'src','sync','api-client.js')).href);
  const reply=(status,body,bad)=>({status,ok:status>=200&&status<300,json:async()=>{if(bad)throw new Error('not json');return body;}});
  const rig=(answer,base)=>{const calls=[];const fetchFn=async(url,init)=>{calls.push({url,init});if(answer instanceof Error)throw answer;return typeof answer==='function'?answer(url,init):answer;};return {calls,api:createApiClient(fetchFn,base)};};
  const fails=async(p)=>{try{await p;return 'no error';}catch(e){return e;}};

  // ---- what is sent
  let r=rig(reply(200,{results:[]}));await r.api.push([{mutationId:'m1'}]);
  eq('push: POST to the sync endpoint',[r.calls[0].init.method,r.calls[0].url],['POST','/api/v1/sync/push']);
  eq('push: the body carries the mutations',JSON.parse(r.calls[0].init.body),{mutations:[{mutationId:'m1'}]});
  eq('every call sends the cookie and the CSRF header',[r.calls[0].init.credentials,r.calls[0].init.headers['x-everfox-csrf'],r.calls[0].init.headers['content-type']],['same-origin','1','application/json']);
  r=rig(reply(200,{changes:[]}));await r.api.changes('a b&c');
  eq('changes: GET, cursor encoded, page size 1000',[r.calls[0].init.method,r.calls[0].url,r.calls[0].init.body],['GET','/api/v1/sync/changes?cursor=a%20b%26c&limit=1000',undefined]);
  r=rig(reply(200,{changes:[]}),'https://api.example.test');await r.api.changes('0');
  eq('a base address is put in front of the path',r.calls[0].url.startsWith('https://api.example.test/api/v1/sync/changes'),true);
  eq('the answer body is returned',await rig(reply(200,{cursor:'7'})).api.changes('0'),{cursor:'7'});

  // ---- failures become three kinds
  eq('no network: offline',(await fails(rig(new Error('Failed to fetch')).api.push([]))).kind,'offline');
  eq('401: unauthorized',(await fails(rig(reply(401,{})).api.push([]))).kind,'unauthorized');
  eq('500: server, with the status',await fails(rig(reply(500,{})).api.push([])),{kind:'server',status:500});
  eq('403 and 429 are server errors too (the sync shows them as such)',[(await fails(rig(reply(403,{})).api.changes('0'))).status,(await fails(rig(reply(429,{})).api.changes('0'))).status],[403,429]);
  eq('a 200 that is not JSON (a proxy page): server',await fails(rig(reply(200,null,true)).api.changes('0')),{kind:'server',status:200});

  // ---- me(): signed in, signed out, or no API here
  eq('me: a person',await rig(reply(200,{id:'u1',email:'a@example.test'})).api.me(),{state:'signed_in',user:{id:'u1',email:'a@example.test'}});
  eq('me: 401 is signed out',await rig(reply(401,{})).api.me(),{state:'signed_out'});
  eq('me: no network is unavailable',await rig(new Error('x')).api.me(),{state:'unavailable'});
  eq('me: a server error is unavailable',await rig(reply(503,{})).api.me(),{state:'unavailable'});
  eq('me: an answer without an id (a static server returned a page) is unavailable',await rig(reply(200,{html:true})).api.me(),{state:'unavailable'});
  eq('me: an id that is not a string is unavailable',await rig(reply(200,{id:7})).api.me(),{state:'unavailable'});

  // ---- logout and the login link
  r=rig(reply(200,{endSessionUrl:null}));eq('logout: true when the API answers',await r.api.logout(),true);
  eq('logout: POST /auth/logout',[r.calls[0].init.method,r.calls[0].url],['POST','/auth/logout']);
  eq('logout: false when it fails',[await rig(new Error('x')).api.logout(),await rig(reply(500,{})).api.logout()],[false,false]);
  eq('loginUrl: returns to / by default',loginUrl(),'/auth/login?returnTo=%2F');
  eq('loginUrl: the return address is encoded',loginUrl('/a?b=1&c=2'),'/auth/login?returnTo=%2Fa%3Fb%3D1%26c%3D2');
  return res;};

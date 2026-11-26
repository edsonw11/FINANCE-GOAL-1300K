/**
 * App lock, the phone side: the gateway turns every answer or failure of the native plugin into plain data.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,res}=suite('app-lock-gateway');
  const G=await import(pathToFileURL(path.join(root,'src','ui','app-lock','lock-gateway.js')).href);
  const cap=(plugin,native=true)=>({isNativePlatform:()=>native,Plugins:plugin?{AppLock:plugin}:{}});
  const reject=code=>{const e=new Error('x');e.code=code;return e;};

  let g=G.lockGateway(undefined);
  eq('a browser: no plugin',g.present,false);
  eq('a browser: the lock is not available',await g.status(),{available:false,reason:'unsupported'});
  eq('a browser: authenticating says unavailable',await g.authenticate({}),{ok:false,code:'unavailable'});
  eq('a browser: setSecure does nothing and does not crash',await g.setSecure(true),undefined);
  g=G.lockGateway(cap(null));eq('the shell without the plugin: not present',g.present,false);
  g=G.lockGateway(cap({status:async()=>({available:true})},false));eq('the plugin outside the shell is ignored',g.present,false);

  const calls=[];
  g=G.lockGateway(cap({status:async()=>({available:true,reason:''}),authenticate:async o=>{calls.push(['auth',o]);},setSecure:async o=>{calls.push(['secure',o]);}}));
  eq('present inside the shell with the plugin',g.present,true);
  eq('status passes the answer through',await g.status(),{available:true,reason:''});
  eq('authenticate resolves to ok',await g.authenticate({title:'T',subtitle:'S'}),{ok:true});
  eq('the prompt text reaches the plugin',calls[0],['auth',{title:'T',subtitle:'S'}]);
  await g.setSecure(true);await g.setSecure(0);
  eq('setSecure sends a real boolean',calls.slice(1),[['secure',{secure:true}],['secure',{secure:false}]]);

  g=G.lockGateway(cap({status:async()=>({available:false,reason:'none-enrolled'})}));
  eq('a phone without a screen lock reports why',await g.status(),{available:false,reason:'none-enrolled'});
  g=G.lockGateway(cap({status:async()=>{throw new Error('boom');}}));
  eq('a status failure reads as not available, not as a crash',await g.status(),{available:false,reason:'error'});
  for(const code of ['cancelled','lockout','unavailable','failed']){
    g=G.lockGateway(cap({authenticate:async()=>{throw reject(code);}}));
    eq('a rejection with code '+code+' is passed on as data',await g.authenticate({}),{ok:false,code});}
  g=G.lockGateway(cap({authenticate:async()=>{throw new Error('no code');}}));
  eq('a rejection without a code is "failed"',await g.authenticate({}),{ok:false,code:'failed'});
  g=G.lockGateway(cap({authenticate:async()=>{throw undefined;}}));
  eq('a rejection with nothing in it is "failed"',await g.authenticate({}),{ok:false,code:'failed'});
  g=G.lockGateway(cap({setSecure:async()=>{throw new Error('boom');}}));
  eq('a setSecure failure does not break the caller',await g.setSecure(true),undefined);
  return res;};

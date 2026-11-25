/**
 * The Android shell: how the app knows it is inside one, and how a backup leaves the phone.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,ok,res}=suite('native-bridge');
  const N=await import(pathToFileURL(path.join(root,'src','ui','native-bridge.js')).href);
  // a scripted Capacitor: records what was asked of the plugins
  const fake=(over={})=>{const calls=[];const cap={isNativePlatform:()=>true,calls,Plugins:{
    Filesystem:{writeFile:async o=>{calls.push(['write',o]);return {uri:'file:///cache/'+o.path};}},
    Share:{share:async o=>{calls.push(['share',o]);}}}};
    return Object.assign(cap,over);};

  eq('no Capacitor object: a browser',N.isNative(undefined),false);
  eq('Capacitor on the web (the library without a shell)',N.isNative({isNativePlatform:()=>false}),false);
  eq('Capacitor inside the shell',N.isNative({isNativePlatform:()=>true}),true);
  eq('an object that is not Capacitor',N.isNative({}),false);
  eq('isNativePlatform that is not a function',N.isNative({isNativePlatform:true}),false);

  let c=fake();
  eq('a backup is written to the cache, then shared by the file address',await N.shareTextFile('{"a":1}','b.json',c),{ok:true});
  eq('the file is written as text in the cache',c.calls[0],['write',{path:'b.json',data:'{"a":1}',directory:'CACHE',encoding:'utf8'}]);
  eq('the share sheet gets the address of that file',c.calls[1][1].url,'file:///cache/b.json');
  eq('write happens before share',c.calls.map(x=>x[0]),['write','share']);

  c=fake();c.Plugins.Share.share=async()=>{throw new Error('Share canceled');};
  eq('closing the share sheet is a cancel, not an error',await N.shareTextFile('x','b.json',c),{ok:false,cancelled:true});
  c=fake();c.Plugins.Filesystem.writeFile=async()=>{throw new Error('disk full');};
  eq('a write failure is reported with its reason',await N.shareTextFile('x','b.json',c),{ok:false,error:'disk full'});
  c=fake();c.Plugins.Filesystem.writeFile=async()=>{throw 'plain string';};
  eq('a thrown string is reported too',await N.shareTextFile('x','b.json',c),{ok:false,error:'plain string'});
  ok('after a write failure nothing is shared',!c.calls.some(x=>x[0]==='share'));

  eq('outside the shell it does nothing',await N.shareTextFile('x','b.json',{isNativePlatform:()=>false,Plugins:{}}),{ok:false,error:'sharing is not available here'});
  eq('without Capacitor it does nothing',await N.shareTextFile('x','b.json',undefined),{ok:false,error:'sharing is not available here'});
  c=fake();delete c.Plugins.Share;
  eq('a missing plugin is reported (not a crash)',await N.shareTextFile('x','b.json',c),{ok:false,error:'sharing is not available here'});
  c=fake();c.Plugins.Filesystem=undefined;
  eq('a missing filesystem plugin is reported too',await N.shareTextFile('x','b.json',c),{ok:false,error:'sharing is not available here'});
  return res;};

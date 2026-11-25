/**
 * App lock, the events: the app leaving and returning is passed to the lock from the Capacitor App plugin.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,res}=suite('app-lock-events');
  const E=await import(pathToFileURL(path.join(root,'src','ui','app-lock','lock-events.js')).href);
  const calls=[];const lock={onForeground:()=>calls.push('fg'),onBackground:()=>calls.push('bg')};
  let handler,name;const cap={isNativePlatform:()=>true,Plugins:{App:{addListener:(n,f)=>{name=n;handler=f;}}}};
  eq('binds inside the shell',E.bindLockEvents(lock,cap),true);
  eq('it listens to the app state',name,'appStateChange');
  handler({isActive:false});handler({isActive:true});handler({isActive:false});
  eq('inactive is "background", active is "foreground"',calls,['bg','fg','bg']);
  handler(undefined);eq('an empty event counts as leaving, and does not crash',calls.slice(-1),['bg']);
  eq('a browser: nothing bound',E.bindLockEvents(lock,{isNativePlatform:()=>false,Plugins:{App:{addListener(){throw new Error('no');}}}}),false);
  eq('no App plugin: nothing bound',E.bindLockEvents(lock,{isNativePlatform:()=>true,Plugins:{}}),false);
  eq('no Capacitor: nothing bound',E.bindLockEvents(lock,undefined),false);
  return res;};

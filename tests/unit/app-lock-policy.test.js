/**
 * App lock, the rules: the on/off flag in the device storage, and the time away that locks the app again.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,res}=suite('app-lock-policy');
  const P=await import(pathToFileURL(path.join(root,'src','ui','app-lock','lock-policy.js')).href);
  const store=()=>{const m={};return {m,getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];}};};
  let st=store();
  eq('the lock is off by default',P.lockEnabled(st),false);
  P.setLockEnabled(true,st);eq('switched on',P.lockEnabled(st),true);
  eq('it is kept under its own key',Object.keys(st.m),[P.LOCK_KEY]);
  P.setLockEnabled(false,st);eq('switched off',P.lockEnabled(st),false);
  eq('switching off leaves no key behind',Object.keys(st.m),[]);
  st=store();st.m[P.LOCK_KEY]='yes';eq('only the exact value 1 means on',P.lockEnabled(st),false);
  const broken={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');},removeItem(){throw new Error('denied');}};
  eq('a storage that fails reads as off',P.lockEnabled(broken),false);
  P.setLockEnabled(true,broken);P.setLockEnabled(false,broken);eq('a storage that fails does not crash a write',true,true);
  eq('the grace period is 30 seconds',P.GRACE_MS,30000);
  eq('never left the screen: no lock',P.shouldLockOnResume(null,1e9),false);
  eq('away for a moment: no lock',P.shouldLockOnResume(1000,1000+29999),false);
  eq('away exactly the grace period: locks',P.shouldLockOnResume(1000,1000+30000),true);
  eq('away for a long time: locks',P.shouldLockOnResume(1000,1000+3600000),true);
  eq('a custom grace period is respected',P.shouldLockOnResume(0,5,5),true);
  eq('a time that is not a number does not lock',P.shouldLockOnResume(undefined,1e9),false);
  return res;};

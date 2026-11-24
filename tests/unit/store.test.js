/** Persistence: injectable storage, rollback on save failure, commands that refuse (domain/store.js). */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run,storage}=createContext(),{eq,ok,res}=suite('store');
  run("S=seed();S.tx=[];");
  const n0=run('S.tx.length');
  storage.fail=true;
  eq('save failure returns false',run("transact(()=>{S.tx.push({id:99,type:'despesa',date:'2026-10-01',value:1,cat:'X'});})"),false);
  storage.fail=false;
  eq('save failure rolls back',run('S.tx.length'),n0);
  eq('success returns true',run("transact(()=>{S.tx.push({id:100,type:'despesa',date:'2026-10-01',value:1,cat:'X'});})"),true);
  eq('success is persisted',JSON.parse(storage.mem['metaapp.v2']).tx.length,n0+1);
  // a command that refuses ({error}) changes nothing and does not save
  const before=storage.mem['metaapp.v2'];
  eq('refused command returns the error',run("transact(()=>{S.tx.length=0;return {error:'não pode'};})"),{error:'não pode'});
  eq('refused command rolls back',run('S.tx.length'),n0+1);
  eq('refused command does not save',storage.mem['metaapp.v2'],before);
  // injectable storage (DIP)
  run("configureStorage({getItem:k=>null,setItem:(k,v)=>{globalThis.__saved=v;}})");
  run("transact(()=>{S.goal=123;})");
  ok('injected storage receives the save',JSON.parse(run('globalThis.__saved')).goal===123);
  run("replaceState(seed())");
  eq('replaceState swaps the state',run('S.goal'),1300000);
  return res;};

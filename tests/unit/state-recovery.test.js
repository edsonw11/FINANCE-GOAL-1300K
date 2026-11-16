/** Data safety: unreadable data is kept aside (never overwritten), a daily automatic copy is kept, a first visit is empty. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('state-recovery');
  const mk=init=>`(()=>{const mem=Object.assign({},${JSON.stringify(init||{})});return {mem,getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=v;}};})()`;
  run(`globalThis.st=${mk({})}`);
  eq('first visit: blank state, nothing recovered',run("(r=>[r.recovered,r.state.accounts.length,r.state.tx.length])(readState(st,'k',()=>blankState()))"),[false,0,0]);
  const good=JSON.stringify({v:2,goal:5,accounts:[],snaps:[],tx:[]});
  run(`globalThis.st=${mk({k:good})}`);
  eq('good data is read as it is',run("(r=>[r.recovered,r.state.goal])(readState(st,'k',()=>blankState()))"),[false,5]);
  run(`globalThis.st=${mk({k:'{not json'})}`);
  const r=run("(r=>[r.recovered,r.state.tx.length,st.mem['k'],st.mem['k.broken']])(readState(st,'k',()=>blankState()))");
  eq('unreadable data: recovered, blank state, the original is untouched and copied aside',r,[true,0,'{not json','{not json']);
  run(`globalThis.st=${mk({k:JSON.stringify({v:3,tx:[]})})}`);
  eq('another version is not overwritten either',run("(r=>[r.recovered,!!st.mem['k.broken']])(readState(st,'k',()=>blankState()))"),[true,true]);
  // daily automatic copy
  run(`globalThis.st=${mk({k:good})}`);
  run("rollBackup(st,'k','2026-11-16')");
  eq('first save of the day keeps the previous good copy',run("readBackup(st,'k').state.goal"),5);
  run("st.mem['k']=JSON.stringify({v:2,goal:9,accounts:[],snaps:[],tx:[]});rollBackup(st,'k','2026-11-16')");
  eq('second save the same day keeps the older copy (the one from before the day)',run("readBackup(st,'k').state.goal"),5);
  run("rollBackup(st,'k','2026-11-17')");
  eq('next day the copy moves forward',[run("readBackup(st,'k').day"),run("readBackup(st,'k').state.goal")],['2026-11-17',9]);
  run(`globalThis.st=${mk({k:'garbage'})}`);run("rollBackup(st,'k','2026-11-16')");
  eq('a broken main copy never replaces the good backup',run("readBackup(st,'k')"),null);
  ok('a full storage does not stop saving',run("(()=>{const s={getItem:()=>JSON.stringify({v:2}),setItem:()=>{throw new Error('full');}};try{rollBackup(s,'k','d');return true;}catch(e){return false;}})()"));
  // the command that puts the automatic copy back
  run("S=blankState();configureStorage({getItem:k=>globalThis.__mem[k]===undefined?null:globalThis.__mem[k],setItem:(k,v)=>{globalThis.__mem[k]=v;}})");
  run("globalThis.__mem={}");
  eq('no automatic copy yet: the command refuses',run("restoreAutoBackup()"),{error:'Ainda não existe cópia automática'});
  run("S.goal=111;save();S.goal=222;globalThis.__mem['metaapp.v2.bak']=JSON.stringify({day:'2026-11-15',json:JSON.stringify(Object.assign({},S,{goal:111}))})");
  eq('restore returns the day and the data of the copy',[run("restoreAutoBackup().day"),run("S.goal")],['2026-11-15',111]);
  return res;};

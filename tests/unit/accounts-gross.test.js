/**
 * Totals of the accounts (domain/accounts.js): net and gross as the apps show them. An account with no gross value counts by its net value, and the total says
 * it is approximate (ok=false) unless that account is empty.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('accounts-gross');
  const J=JSON.stringify,snap=(date,acc,value,gross)=>({date,acc,value,est:false,...(gross===undefined?{}:{gross})});
  const world=(snaps,tx)=>run(`S=seed();S.accounts=${J([{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}])};S.snaps=${J(snaps)};S.tx=${J(tx||[])};true`);
  const gross=d=>run(`totalGross('${d}')`);
  world([snap('2026-11-01','a',100,110),snap('2026-11-01','b',50)]);
  eq('gross adds the gross of the accounts that have it and the net of the others',gross('2026-11-30').g,160);
  eq('and says it is approximate when an account with money has no gross',gross('2026-11-30').ok,false);
  world([snap('2026-11-01','a',100,110),snap('2026-11-01','b',0)]);
  eq('an empty account without gross does not make it approximate',gross('2026-11-30'),{g:110,ok:true});
  world([snap('2026-11-01','a',100,110),snap('2026-11-01','b',50,52),snap('2026-11-01','c',1,2)]);
  eq('all gross known: exact',gross('2026-11-30'),{g:164,ok:true});
  world([snap('2026-11-01','a',100,110)],[{id:1,type:'aporte',acc:'a',date:'2026-11-10',value:10}]);
  eq('a contribution after the balance adds to both net and gross',[run("balance('a','2026-11-30').v"),gross('2026-11-30').g],[110,120]);
  eq('a contribution after the asked date is not counted yet',gross('2026-11-05').g,110);
  eq('a contribution on the day of the balance is already inside it',(()=>{world([snap('2026-11-10','a',100,110)],[{id:1,type:'aporte',acc:'a',date:'2026-11-10',value:10}]);return gross('2026-11-30').g;})(),110);
  world([snap('2026-11-20','a',100,110)]);
  eq('before the first balance an account counts as nothing',gross('2026-11-01'),{g:0,ok:true});
  world([snap('2026-10-01','a',100,110),snap('2026-11-01','a',200,215)]);
  eq('the latest balance up to the date wins',[gross('2026-10-15').g,gross('2026-11-15').g],[110,215]);
  world([snap('2026-11-01','a',0.003)]);
  eq('a balance under half a cent is treated as empty',gross('2026-11-30').ok,true);
  eq('total (net) adds every account',(()=>{world([snap('2026-11-01','a',100,110),snap('2026-11-01','b',50)]);return run("total('2026-11-30')");})(),150);
  eq('two balances of the same account on the same day: the later one in the list is used',run("(S=seed(),S.tx=[],S.snaps=[{date:'2026-10-01',acc:'nu',value:10,est:false},{date:'2026-10-01',acc:'nu',value:20,est:false}],balance('nu','2026-10-05').v)"),20);
  return res;};

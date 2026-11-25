/**
 * domain/store.js
 * Responsibility: Application state (S) and localStorage persistence: seed, load, save, migrations.
 */
import { STORAGE_KEY } from '../core/config.js';
import { today } from '../core/dates.js';
import { balance } from './accounts.js';
import { invalidateAllocation } from './card-invoices.js';
import { readBackup, readState, rollBackup } from './state-recovery.js';
export const seed=()=>({v:2,goal:1300000,rate:12.5,planned:0,nid:1,
  accounts:[{id:'nu',name:'Nubank'},{id:'in',name:'Inter'},{id:'s28',name:'Tesouro Selic 2028'},{id:'s31',name:'Tesouro Selic 2031'}],
  snaps:[['nu',157062.83,true,159830.14],['in',154796,true],['s28',395040,true],['s31',423375,true]].map(([acc,value,est,gross])=>gross?({date:'2026-11-06',acc,value,est,gross}):({date:'2026-11-06',acc,value,est})),
  tx:[]});
// nothing at all: no accounts, balances or records (what "Apagar tudo" leaves; the goal and the rate are settings and are kept)
export const blankState=prev=>({v:2,goal:prev?prev.goal:1300000,rate:prev?prev.rate:12.5,planned:0,nid:1,accounts:[],snaps:[],tx:[],...(prev&&prev.ownNames?{ownNames:prev.ownNames}:{})});
// Santander was emptied: moves the balance to Nubank and archives the account (once)
export function migrate(){
  const sa=S.accounts.find(a=>a.id==='sa'),nu=S.accounts.find(a=>a.id==='nu');
  if(!sa||sa.archived||!nu)return;
  const d=today(),vSa=balance('sa',d).v,vNu=balance('nu',d).v;
  S.snaps=S.snaps.filter(s=>!(s.date===d&&(s.acc==='sa'||(vSa>0.005&&s.acc==='nu'))));
  if(vSa>0.005)S.snaps.push({date:d,acc:'nu',value:vNu+vSa,est:false});
  S.snaps.push({date:d,acc:'sa',value:0,est:false});
  sa.archived=true;save();
}
// storage is injected (DIP): the browser uses localStorage; tests pass an in-memory one
let storage=typeof localStorage!=='undefined'?localStorage:{getItem:()=>null,setItem:()=>{}};
export function configureStorage(adapter){storage=adapter;}
// what happened when the app opened: recovered=true when the saved data could not be read (a copy was kept aside)
export const bootNotice={recovered:false};
// a first visit opens an empty app (the example data is on demand); unreadable data is kept aside, never overwritten
function load(){const r=readState(storage,STORAGE_KEY,()=>blankState());bootNotice.recovered=r.recovered;return r.state;}
export const autoBackup=()=>readBackup(storage,STORAGE_KEY);
export function save(){invalidateAllocation();rollBackup(storage,STORAGE_KEY,today());storage.setItem(STORAGE_KEY,JSON.stringify(S));saveListeners.forEach(f=>{try{f();}catch(e){/* a listener must never break saving */}});}
// who wants to know when the state was saved (the sync looks for changes to send); each listener is called after the data is stored
const saveListeners=[];
export const onSave=fn=>{saveListeners.push(fn);};
// the state as the sync has merged it from the server: stored like any other change
export function adoptRemoteState(next){S=next;save();}
// swaps the whole state (backup import, reset); the caller saves it through transact()
export function replaceState(next){S=next;invalidateAllocation();}
/**
 * transact(mutate): runs a change and saves it.
 * - saving fails (storage full, private mode): the change is undone and false is returned,
 *   so the screen keeps what the user typed and explains the problem;
 * - the command refuses (returns {error}): the change is undone, nothing is saved, the error is returned;
 * - otherwise: returns the command result (or true).
 */
export function transact(mutate){
  const before=JSON.stringify(S);
  const restore=()=>{S=JSON.parse(before);invalidateAllocation();};
  let r;
  try{r=mutate();}catch(e){restore();transact.lastError=e;return false;}
  if(r&&r.error){restore();return r;}
  try{save();}catch(e){restore();transact.lastError=e;return false;}
  return r===undefined?true:r;
}
// the error of the last failed change (for diagnosis); null until something fails
transact.lastError=null;
// storage used inside withState(): reads find nothing, writes are dropped
const NO_STORAGE={getItem:()=>null,setItem:()=>{}};
/**
 * withState(state, fn): runs domain code against a given state (one user's data on the server, a test fixture)
 * and puts the previous state back afterwards, also when fn throws. Nested calls are fine.
 * - synchronous only: an async fn would let other code run while this state is in force, so a promise result
 *   is refused with an error;
 * - nothing is persisted: transact() inside it saves nowhere; storing the result is the caller's job;
 * - returns {result, state}: state is the one in force at the end (a command may swap it, e.g. backup import).
 * See docs/architecture/decisions/ADR-0006.
 */
export function withState(state,fn){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('withState: state must be an object');
  if(typeof fn!=='function')throw new TypeError('withState: fn must be a function');
  const prevState=S,prevStorage=storage;
  S=state;storage=NO_STORAGE;invalidateAllocation();
  try{
    const result=fn();
    if(result&&typeof result.then==='function')throw new Error('withState: fn must be synchronous');
    return {result,state:S};
  }finally{S=prevState;storage=prevStorage;invalidateAllocation();}
}
export let S=load();

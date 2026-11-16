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
export const blankState=prev=>({v:2,goal:prev?prev.goal:1300000,rate:prev?prev.rate:12.5,planned:0,nid:1,accounts:[],snaps:[],tx:[]});
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
function configureStorage(adapter){storage=adapter;}
// what happened when the app opened: recovered=true when the saved data could not be read (a copy was kept aside)
export const bootNotice={recovered:false};
// a first visit opens an empty app (the example data is on demand); unreadable data is kept aside, never overwritten
function load(){const r=readState(storage,STORAGE_KEY,()=>blankState());bootNotice.recovered=r.recovered;return r.state;}
export const autoBackup=()=>readBackup(storage,STORAGE_KEY);
export function save(){invalidateAllocation();rollBackup(storage,STORAGE_KEY,today());storage.setItem(STORAGE_KEY,JSON.stringify(S));}
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
export let S=load();

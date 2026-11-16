/**
 * domain/state-recovery.js
 * Responsibility: keeps the user's data from being lost silently. Reads the saved state; when what is stored
 * cannot be read, it is copied aside (never overwritten) and a blank state is used instead; and once a day it
 * keeps the previous good copy, so yesterday's data can be restored. Pure functions over a storage adapter.
 */
export const BACKUP_SUFFIX='.bak',BROKEN_SUFFIX='.broken';
const parseState=raw=>{try{const r=JSON.parse(raw);return r&&r.v===2?r:null;}catch(e){return null;}};
// -> {state, recovered}: recovered=true when something was stored but could not be read (a copy was kept aside)
export function readState(storage,key,blank){
  const raw=storage.getItem(key);
  if(raw==null)return {state:blank(),recovered:false};
  const ok=parseState(raw);
  if(ok)return {state:ok,recovered:false};
  try{storage.setItem(key+BROKEN_SUFFIX,raw);}catch(e){/* storage full: nothing more to do */}
  return {state:blank(),recovered:true};
}
// call before overwriting the saved state: keeps the last good copy, at most once a day
export function rollBackup(storage,key,day){
  const cur=storage.getItem(key);if(!parseState(cur))return;
  const b=readBackupRaw(storage,key);if(b&&b.day===day)return;
  try{storage.setItem(key+BACKUP_SUFFIX,JSON.stringify({day,json:cur}));}catch(e){/* storage full: the main save still goes ahead */}
}
function readBackupRaw(storage,key){try{return JSON.parse(storage.getItem(key+BACKUP_SUFFIX));}catch(e){return null;}}
// -> {day, state} of the automatic copy, or null
export function readBackup(storage,key){const b=readBackupRaw(storage,key),s=b&&parseState(b.json);return s?{day:b.day,state:s}:null;}

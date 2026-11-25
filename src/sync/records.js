/**
 * sync/records.js
 * Responsibility: how the app's state maps to synced records (the same split the server makes) and a stable fingerprint to see what changed. Pure functions.
 */
// the lists of the state and the kind each becomes; everything else is the settings document (same table as the server: legacy-state.ts)
export const LISTS={accounts:'account',snaps:'snap',tx:'tx',trades:'trade',transfers:'transfer',imports:'import'};
export const LISTS_MARK='_lists';
const LIST_NAMES=Object.keys(LISTS);
export const listOfKind=kind=>LIST_NAMES.find(n=>LISTS[n]===kind);

/** The key a record has in the app ('nu', 12, 't7', the hash of an imported file); a balance has none of its own, so it is identified by day and account. */
export function keyOf(kind,body){
  if(!body||typeof body!=='object')return null;
  if(kind==='snap')return body.date==null||body.acc==null?null:body.date+'|'+body.acc;
  const raw=kind==='import'?body.hash:body.id;
  return raw==null?null:String(raw);
}
/** What the server stores as the legacy key: a balance has none. */
export const legacyKeyOf=(kind,body)=>kind==='snap'?null:keyOf(kind,body);
export const refOf=(kind,key)=>kind+':'+key;

function stable(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  return '{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
}
/** A 53-bit fingerprint of a value, the same for the same content whatever the order of its keys (cyrb53). */
export function fingerprint(value){
  const s=stable(value);let h1=0xdeadbeef,h2=0x41c6ce57;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)+'.'+s.length;
}

/** The settings document: the state without its lists, plus which lists exist (an absent list is not an empty one for the rules). */
export function settingsOf(state){
  const out={};
  for(const k of Object.keys(state))if(!Object.hasOwn(LISTS,k))out[k]=state[k];
  out[LISTS_MARK]=LIST_NAMES.filter(n=>Array.isArray(state[n]));
  return out;
}

/** The state as records: ref -> {kind,key,body,fp}, and the settings. A record with no key cannot be synced and is left out (listed in `skipped`). */
export function splitState(state){
  const records=new Map();let skipped=0;
  for(const name of LIST_NAMES){
    const list=state[name];if(!Array.isArray(list))continue;
    const kind=LISTS[name];
    for(const body of list){
      const key=keyOf(kind,body);
      if(key===null){skipped++;continue;}
      records.set(refOf(kind,key),{kind,key,body,fp:fingerprint(body)});
    }
  }
  const settings=settingsOf(state);
  return {records,settings,settingsFp:fingerprint(settings),skipped};
}

/**
 * core/id-counter.js
 * Responsibility: keeps the id counter `nid` usable. The counter hands out ids (numbers for transactions, 'a7' accounts, 't7' trades, 'tr7' transfers, and the series
 * number of repeated records). Data that comes from outside (browser storage, a backup file, the server's settings document) may carry a counter that is missing,
 * null, NaN, zero, negative, fractional, too large, or behind the ids already in use; any of those would hand out an id that is NaN, falsy or already taken.
 * Pure: a state with a good counter is returned exactly as it is.
 */
const OWN_LISTS=['accounts','tx','trades','transfers'];
const ID_NUMBER=/^(?:a|t|tr)?(\d+)$/;
const ROOM=100; // a counter closer than this to the largest safe integer would soon stop counting (n+1 === n)
const SAFE_TOP=Number.MAX_SAFE_INTEGER-ROOM;

/** The number inside an id ('a12' -> 12, 7 -> 7); 0 for ids that are not numbered ('nu', 'sa'). */
export const numberOfId=id=>{const m=ID_NUMBER.exec(String(id));const n=m?+m[1]:0;return Number.isSafeInteger(n)&&n<=SAFE_TOP?n:0;};
const usableCounter=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=1&&n<=SAFE_TOP;

/** The smallest counter that cannot collide with any id in the state. */
export function counterFloor(state){
  let top=0;
  for(const name of OWN_LISTS){
    const list=state&&state[name];if(!Array.isArray(list))continue;
    for(const item of list){
      if(!item||typeof item!=='object')continue;
      top=Math.max(top,numberOfId(item.id));
      if(name==='tx'&&item.serie!==undefined)top=Math.max(top,numberOfId(item.serie));
    }
  }
  return top+1;
}

/** Makes `state.nid` a safe integer of at least 1 that is past every id in use. Changes the object it is given and returns it. */
export function repairIdCounter(state){
  if(!state||typeof state!=='object')return state;
  const floor=counterFloor(state);
  if(!usableCounter(state.nid))state.nid=floor;
  else if(state.nid<floor)state.nid=floor;
  return state;
}

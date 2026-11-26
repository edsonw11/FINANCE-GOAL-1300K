/**
 * ui/app-lock/lock-policy.js
 * Responsibility: the rules of the app lock, with no screen and no phone in them: is it switched on (a flag in the device storage), and has the app been away long enough to lock again.
 */
export const LOCK_KEY='metaapp.lock';
/** Leaving the app for a moment (a notification, the share sheet) does not lock it; leaving it for this long does. */
export const GRACE_MS=30000;
export function lockEnabled(storage=globalThis.localStorage){
  try{return storage.getItem(LOCK_KEY)==='1';}catch(e){return false;}
}
export function setLockEnabled(on,storage=globalThis.localStorage){
  try{if(on)storage.setItem(LOCK_KEY,'1');else storage.removeItem(LOCK_KEY);}catch(e){/* storage unavailable: the lock stays as it was */}
}
/** backgroundedAt: when the app left the screen (ms), or null when it did not. */
export function shouldLockOnResume(backgroundedAt,now,grace=GRACE_MS){
  return typeof backgroundedAt==='number'&&now-backgroundedAt>=grace;
}

/**
 * ui/app-lock/lock-gateway.js
 * Responsibility: the only place that talks to the native AppLock plugin (the Android biometric / device-credential prompt and the screen-capture flag).
 * It turns every outcome into plain data, so the rest of the lock never sees an exception. Outside the Android shell it reports "not available".
 * authenticate() answers {ok:true} or {ok:false,code}: code is 'cancelled' | 'lockout' | 'unavailable' | 'failed'.
 */
import { isNative } from '../native-bridge.js';
export function lockGateway(cap=globalThis.Capacitor){
  const P=cap&&cap.Plugins&&cap.Plugins.AppLock;
  const present=isNative(cap)&&!!P;
  return {
    present,
    async status(){
      if(!present)return {available:false,reason:'unsupported'};
      try{const s=await P.status();return {available:!!s.available,reason:s.reason||''};}
      catch(e){return {available:false,reason:'error'};}
    },
    async authenticate(opts){
      if(!present)return {ok:false,code:'unavailable'};
      try{await P.authenticate(opts);return {ok:true};}
      catch(e){return {ok:false,code:(e&&e.code)||'failed'};}
    },
    /** Hides the app from the recent-apps list and from screenshots while the lock is on. */
    async setSecure(secure){
      if(!present)return;
      try{await P.setSecure({secure:!!secure});}catch(e){/* cosmetic protection: its failure must not block the lock */}
    },
  };
}

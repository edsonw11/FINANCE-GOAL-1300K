/**
 * ui/app-lock/app-lock.js
 * Responsibility: the lock's behaviour: when to lock (at start and after the app was away), how to unlock, how to switch it on and off.
 * It is built from three parts it does not know the insides of: the gateway (the phone), the screen (the dialog) and the storage (the on/off flag).
 * If the phone has no screen lock any more, the lock cannot work, so it switches itself off instead of shutting the person out.
 */
import { t } from '../../core/i18n.js';
import { lockEnabled, setLockEnabled, shouldLockOnResume } from './lock-policy.js';
const TEXT={
  get title(){return t('sys.lock.title');},
  get subtitle(){return t('sys.lock.subtitle');},
  get cancelled(){return t('sys.lock.cancelled');},
  get lockout(){return t('sys.lock.lockout');},
  get failed(){return t('sys.lock.failed');},
  get gone(){return t('sys.lock.gone');},
  get needDeviceLock(){return t('sys.lock.needDeviceLock');},
};
export const LOCK_TEXT=TEXT;
export function createAppLock({gateway,screen,storage,now=Date.now,notify=()=>{}}){
  let locked=false,busy=false,awayAt=null;
  const messageFor=code=>code==='cancelled'?TEXT.cancelled:code==='lockout'?TEXT.lockout:TEXT.failed;
  function unlock(){locked=false;awayAt=null;screen.message('');screen.hide();}
  async function turnOffBecauseUnavailable(){
    setLockEnabled(false,storage);await gateway.setSecure(false);unlock();notify(TEXT.gone);
  }
  /** Asks the phone to confirm the person. Only one request at a time. */
  async function prompt(){
    if(busy||!locked)return;
    busy=true;
    try{
      const st=await gateway.status();
      if(!st.available){await turnOffBecauseUnavailable();return;}
      const r=await gateway.authenticate({title:TEXT.title,subtitle:TEXT.subtitle});
      if(r.ok)unlock();
      else if(r.code==='unavailable')await turnOffBecauseUnavailable();
      else screen.message(messageFor(r.code));
    }finally{busy=false;}
  }
  function lock(){
    if(locked||!lockEnabled(storage))return;
    locked=true;screen.message('');screen.show();prompt();
  }
  return {
    isLocked:()=>locked,
    isEnabled:()=>lockEnabled(storage),
    /** At app start: wire the button, then lock at once when the lock is on. */
    start(){screen.bind(prompt);gateway.setSecure(lockEnabled(storage));lock();},
    retry:prompt,
    /** The app left the screen / came back. The system prompt also pauses the app, but then the app is locked already, and unlocking forgets the time away. */
    onBackground(){awayAt=now();},
    onForeground(){const was=awayAt;awayAt=null;if(shouldLockOnResume(was,now()))lock();},
    /** Switching on needs a phone with a screen lock and one successful confirmation, so the person cannot lock themselves out. */
    async enable(){
      const st=await gateway.status();
      if(!st.available)return {ok:false,message:TEXT.needDeviceLock};
      const r=await gateway.authenticate({title:t('sys.lock.enableTitle'),subtitle:TEXT.subtitle});
      if(!r.ok)return {ok:false,message:r.code==='cancelled'?'':messageFor(r.code)};
      setLockEnabled(true,storage);await gateway.setSecure(true);
      return {ok:true};
    },
    /** Switching off also needs the confirmation: someone holding an unlocked phone cannot just remove the lock. */
    async disable(){
      const r=await gateway.authenticate({title:t('sys.lock.disableTitle'),subtitle:TEXT.subtitle});
      if(!r.ok)return {ok:false,message:r.code==='cancelled'?'':messageFor(r.code)};
      setLockEnabled(false,storage);await gateway.setSecure(false);
      return {ok:true};
    },
  };
}

/**
 * ui/app-lock/lock-events.js
 * Responsibility: tells the lock when the app leaves and returns to the screen, from the Capacitor App plugin (appStateChange) or, in a browser, from the page's visibility.
 */
import { isNative } from '../native-bridge.js';
export function bindLockEvents(lock,cap=globalThis.Capacitor){
  const A=cap&&cap.Plugins&&cap.Plugins.App;
  if(!isNative(cap)||!A||typeof A.addListener!=='function')return false;
  A.addListener('appStateChange',s=>{if(s&&s.isActive)lock.onForeground();else lock.onBackground();});
  return true;
}

/**
 * ui/native-bridge.js
 * Responsibility: what changes when the app runs inside the Android shell (Capacitor) instead of a browser: how it knows, and how a file leaves the phone.
 * A WebView does not download a Blob link, so a backup goes through the system share sheet (save to Files, Drive, e-mail, ...).
 * The platform is a parameter (default: the global Capacitor object) so the logic runs in tests without a device.
 */
import { t } from '../core/i18n.js';
export const isNative=(cap=globalThis.Capacitor)=>!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
/**
 * Writes `text` to a file in the app's cache and opens the share sheet for it.
 * Returns {ok:true}, or {ok:false,cancelled:true} when the person closed the sheet, or {ok:false,error} when it could not be done.
 */
export async function shareTextFile(text,name,cap=globalThis.Capacitor){
  const P=cap&&cap.Plugins;
  if(!isNative(cap)||!P||!P.Filesystem||!P.Share)return {ok:false,error:'sharing is not available here'};
  try{
    const file=await P.Filesystem.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});
    await P.Share.share({title:name,dialogTitle:t('sys.share.saveBackup'),url:file.uri});
    return {ok:true};
  }catch(e){
    const msg=String(e&&e.message||e);
    // closing the sheet is an answer, not a failure
    if(/cancel/i.test(msg))return {ok:false,cancelled:true};
    return {ok:false,error:msg};
  }
}

// ---- the hardware Back button ----
// The Android WebView does not give a <dialog> the Back gesture, and Capacitor then leaves the app. So the app answers Back itself:
// the innermost thing on screen closes first, then the tab goes back to the summary, and only then the app is left.
const DIALOGS=['itemDlg','sugDlg','catDlg'];
/** What Back should do for what is on screen: 'confirm-cancel' | 'dialog-close' | 'sheet-back' | 'sheet-close' | 'home' | 'exit'. s: {locked,confirmOpen,dialogOpen,sheetOpen,sheetDepth,tab} */
export function backAction(s){
  if(s.locked)return 'exit';
  if(s.confirmOpen)return 'confirm-cancel';
  if(s.dialogOpen)return 'dialog-close';
  if(s.sheetOpen)return s.sheetDepth>1?'sheet-back':'sheet-close';
  if(s.tab&&s.tab!=='resumo')return 'home';
  return 'exit';
}
/** What is on screen, read from the page (the confirmation, the other dialogs, the sheet and how deep it is, the current tab). */
export function readScreen(doc){
  const open=id=>{const d=doc.getElementById(id);return !!(d&&d.open);};
  const on=doc.querySelector('#nav button.on');
  return {locked:open('lockDlg'),confirmOpen:open('confirmDlg'),dialogOpen:DIALOGS.some(open),sheetOpen:open('sheet'),
    sheetDepth:doc.getElementById('shBack')&&!doc.getElementById('shBack').hidden?2:1,tab:on?on.dataset.t:'resumo'};
}
/** Does what backAction said, through the app's own controls (so each screen cleans up the way it always does). */
export function doBack(action,doc,cap=globalThis.Capacitor){
  const click=sel=>{const e=doc.querySelector(sel);if(e)e.click();};
  if(action==='confirm-cancel')click('#cfCancel');
  else if(action==='dialog-close'){const d=DIALOGS.map(id=>doc.getElementById(id)).find(x=>x&&x.open);if(d)d.close();}
  else if(action==='sheet-back')click('#shBack');
  else if(action==='sheet-close')click('#shClose');
  else if(action==='home')click('#nav [data-t=resumo]');
  else if(action==='exit'){const A=cap&&cap.Plugins&&cap.Plugins.App;if(A&&A.exitApp)A.exitApp();}
}
/** Listens to the Back button inside the Android shell; a no-op in a browser. Returns true when it is listening. */
export function bindNativeBack(doc=document,cap=globalThis.Capacitor){
  const A=cap&&cap.Plugins&&cap.Plugins.App;
  if(!isNative(cap)||!A||typeof A.addListener!=='function')return false;
  A.addListener('backButton',()=>doBack(backAction(readScreen(doc)),doc,cap));
  return true;
}

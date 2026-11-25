/**
 * ui/native-bridge.js
 * Responsibility: what changes when the app runs inside the Android shell (Capacitor) instead of a browser: how it knows, and how a file leaves the phone.
 * A WebView does not download a Blob link, so a backup goes through the system share sheet (save to Files, Drive, e-mail, ...).
 * The platform is a parameter (default: the global Capacitor object) so the logic runs in tests without a device.
 */
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
    await P.Share.share({title:name,dialogTitle:'Salvar backup',url:file.uri});
    return {ok:true};
  }catch(e){
    const msg=String(e&&e.message||e);
    // closing the sheet is an answer, not a failure
    if(/cancel/i.test(msg))return {ok:false,cancelled:true};
    return {ok:false,error:msg};
  }
}

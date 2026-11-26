/**
 * App lock, the Ajustes card: hidden outside the Android shell, one button that switches the lock, and the messages that follow.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,ok,res}=suite('app-lock-settings');
  const els={};for(const id of ['lockTitle','lockCard','lockToggle','lockHelp','toast'])els[id]={hidden:false,textContent:'',disabled:false,classList:{add(){},toggle(){}},appendChild(){},matches:()=>false};
  globalThis.document={getElementById:id=>els[id]||null};
  globalThis.requestAnimationFrame=f=>f();
  const V=await import(pathToFileURL(path.join(root,'src','ui','views','lock-settings.js')).href);
  const fakeLock=(on,result)=>({on,isEnabled(){return this.on;},async enable(){this.on=result.ok;return result;},async disable(){this.on=!result.ok;return result;}});
  let lock=fakeLock(false,{ok:true});
  V.renderLockCard(lock,false);
  eq('outside the shell the card and its title are hidden',[els.lockTitle.hidden,els.lockCard.hidden],[true,true]);
  V.renderLockCard(lock,true);
  eq('inside the shell they are shown',[els.lockTitle.hidden,els.lockCard.hidden],[false,false]);
  ok('off: the button offers to switch on',/Ativar/.test(els.lockToggle.textContent));
  ok('off: the help says no new password is created',/não cria uma senha nova/.test(els.lockHelp.textContent));
  lock=fakeLock(true,{ok:true});V.renderLockCard(lock,true);
  ok('on: the button offers to switch off',/Desativar/.test(els.lockToggle.textContent));
  ok('on: the help names the 30 seconds and the recent-apps list',/30 segundos/.test(els.lockHelp.textContent)&&/recentes/.test(els.lockHelp.textContent));

  lock=fakeLock(false,{ok:true});V.bindLockSettings(lock,true);await els.lockToggle.onclick();
  eq('tapping switches on, tells it, and redraws the button',[lock.on,els.toast.textContent,/Desativar/.test(els.lockToggle.textContent),els.lockToggle.disabled],[true,'Bloqueio do app ativado',true,false]);
  lock=fakeLock(true,{ok:true});V.bindLockSettings(lock,true);await els.lockToggle.onclick();
  eq('tapping again switches off and tells it',[lock.on,els.toast.textContent],[false,'Bloqueio do app desativado']);
  lock=fakeLock(false,{ok:false,message:'Aguarde'});V.bindLockSettings(lock,true);await els.lockToggle.onclick();
  eq('a refusal with a reason shows it as a warning',[lock.on,els.toast.textContent],[false,'⚠️ Aguarde']);
  els.toast.textContent='before';lock=fakeLock(false,{ok:false,message:''});V.bindLockSettings(lock,true);await els.lockToggle.onclick();
  eq('a cancelled confirmation says nothing',els.toast.textContent,'before');
  els.lockToggle.onclick=null;V.bindLockSettings(lock,false);
  eq('outside the shell nothing is bound',els.lockToggle.onclick,null);
  // the toast schedules its own hiding a few seconds later: stop those timers before the fake page goes away, or the runner crashes when it is still busy
  const T=await import(pathToFileURL(path.join(root,'src','ui','toast.js')).href);
  clearTimeout(T.toast.h);clearTimeout(T.toast.h2);
  delete globalThis.document;delete globalThis.requestAnimationFrame;
  return res;};

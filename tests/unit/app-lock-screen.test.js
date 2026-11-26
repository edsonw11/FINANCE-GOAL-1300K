/**
 * App lock, the screen: the dialog is shown and hidden, carries a message, cannot be dismissed, and its button is reported.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,res}=suite('app-lock-screen');
  const S=await import(pathToFileURL(path.join(root,'src','ui','app-lock','lock-screen.js')).href);
  const page=()=>{const listeners=[];const els={
    lockDlg:{open:false,showModal(){this.open=true;},close(){this.open=false;},addEventListener:(n,f)=>listeners.push([n,f])},
    lockMsg:{textContent:''},lockRetry:{onclick:null}};
    return {els,listeners,getElementById:id=>els[id]||null};};
  let d=page(),s=S.lockScreen(d);
  eq('closed at first',s.isOpen(),false);
  s.show();eq('show opens it as a modal',[s.isOpen(),d.els.lockDlg.open],[true,true]);
  s.show();eq('showing twice is harmless',s.isOpen(),true);
  s.hide();eq('hide closes it',s.isOpen(),false);
  s.hide();eq('hiding twice is harmless',s.isOpen(),false);
  s.message('Tente de novo');eq('a message is written to the screen',d.els.lockMsg.textContent,'Tente de novo');
  s.message();eq('no text clears the message',d.els.lockMsg.textContent,'');
  let n=0,prevented=0;s.bind(()=>{n++;});d.els.lockRetry.onclick();
  eq('the button runs the given function',n,1);
  const [name,fn]=d.listeners[0];fn({preventDefault(){prevented++;}});
  eq('the dialog\'s cancel event (Esc, system Back) is blocked',[name,prevented],['cancel',1]);
  const empty={getElementById:()=>null};const e=S.lockScreen(empty);e.show();e.hide();e.message('x');e.bind(()=>{});
  eq('a page without the lock markup does not crash',e.isOpen(),false);
  return res;};

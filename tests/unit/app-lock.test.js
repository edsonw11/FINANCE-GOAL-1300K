/**
 * App lock, the behaviour: when it locks, how it unlocks, how it is switched on and off, and the ways it must not lock a person out.
 * The phone, the screen and the storage are replaced by scripted fakes, so this runs without a device.
 */
const path=require('path'),{pathToFileURL}=require('url');
const {suite,root}=require('./harness');
module.exports=async()=>{const {eq,ok,res}=suite('app-lock');
  const L=await import(pathToFileURL(path.join(root,'src','ui','app-lock','app-lock.js')).href);
  const P=await import(pathToFileURL(path.join(root,'src','ui','app-lock','lock-policy.js')).href);
  const store=on=>{const m=on?{[P.LOCK_KEY]:'1'}:{};return {m,getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];}};};
  // a scripted phone: answers come from `phone`, every call is written to `log`
  const make=(o={})=>{
    const log=[],phone={available:true,auth:[{ok:true}],...o.phone};let t=0;
    const gateway={present:true,
      status:async()=>{log.push('status');return {available:phone.available,reason:phone.reason||''};},
      authenticate:async x=>{log.push('auth:'+x.title);if(phone.hold)await new Promise(r=>{phone.answer=r;});return phone.auth.length>1?phone.auth.shift():phone.auth[0];},
      setSecure:async v=>{log.push('secure:'+v);}};
    const screen={open:false,msg:'',bound:null,isOpen(){return this.open;},show(){this.open=true;log.push('show');},hide(){this.open=false;log.push('hide');},message(m){this.msg=m;},bind(fn){this.bound=fn;}};
    const notes=[],storage=store(o.on);
    const lock=L.createAppLock({gateway,screen,storage,now:()=>t,notify:m=>notes.push(m)});
    return {lock,log,phone,screen,storage,notes,at:ms=>{t=ms;}};
  };
  const settle=()=>new Promise(r=>setTimeout(r,0));

  // ---- start ----
  let k=make();k.lock.start();await settle();
  eq('lock off: nothing is shown and the phone is not asked',[k.screen.open,k.lock.isLocked(),k.log.filter(x=>x!=='secure:false')],[false,false,[]]);
  eq('lock off: the screen-capture flag is cleared',k.log,['secure:false']);
  ok('start wires the "Desbloquear" button',typeof k.screen.bound==='function');

  k=make({on:true});k.lock.start();
  eq('lock on: the screen is shown at once, before any answer from the phone',[k.screen.open,k.lock.isLocked()],[true,true]);
  await settle();
  eq('lock on: the phone is asked, and a yes opens the app',[k.screen.open,k.lock.isLocked()],[false,false]);
  eq('lock on: status is checked before the prompt',k.log,['secure:true','show','status','auth:Desbloquear o Everfox','hide']);

  // ---- unlock failures ----
  k=make({on:true,phone:{auth:[{ok:false,code:'cancelled'}]}});k.lock.start();await settle();
  eq('cancelled: stays locked, with a hint to try again',[k.lock.isLocked(),k.screen.open,/Desbloquear/.test(k.screen.msg)],[true,true,true]);
  k.phone.auth=[{ok:true}];await k.screen.bound();
  eq('the button asks again, and a yes unlocks',[k.lock.isLocked(),k.screen.open,k.screen.msg],[false,false,'']);
  k=make({on:true,phone:{auth:[{ok:false,code:'lockout'}]}});k.lock.start();await settle();
  eq('lockout: stays locked and says to wait',[k.lock.isLocked(),/Aguarde/.test(k.screen.msg)],[true,true]);
  k=make({on:true,phone:{auth:[{ok:false,code:'failed'}]}});k.lock.start();await settle();
  eq('a failure: stays locked, with a message',[k.lock.isLocked(),/Não foi possível/.test(k.screen.msg)],[true,true]);

  // ---- never lock a person out ----
  k=make({on:true,phone:{available:false,reason:'none-enrolled'}});k.lock.start();await settle();
  eq('the phone lost its screen lock: the app opens and the lock switches itself off',[k.lock.isLocked(),k.screen.open,k.lock.isEnabled()],[false,false,false]);
  eq('...and says why',k.notes.length===1&&/sem bloqueio de tela/.test(k.notes[0]),true);
  eq('...and the capture flag is cleared',k.log.includes('secure:false'),true);
  k=make({on:true,phone:{auth:[{ok:false,code:'unavailable'}]}});k.lock.start();await settle();
  eq('the prompt itself says unavailable: same way out',[k.lock.isLocked(),k.lock.isEnabled(),k.notes.length],[false,false,1]);

  // ---- one prompt at a time ----
  k=make({on:true,phone:{auth:[{ok:false,code:'cancelled'}]}});k.lock.start();
  k.lock.retry();k.lock.retry();await settle();
  eq('taps while a prompt is open do not stack prompts',k.log.filter(x=>x.startsWith('auth:')).length,1);
  k=make();k.lock.retry();await settle();
  eq('retry while not locked asks nothing',k.log,[]);

  // ---- locking again after time away ----
  k=make({on:true});k.lock.start();await settle();
  k.at(1000);k.lock.onBackground();k.at(1000+29999);k.lock.onForeground();await settle();
  eq('back after a short time: still open',k.lock.isLocked(),false);
  k.at(50000);k.lock.onBackground();k.at(50000+30000);k.lock.onForeground();
  eq('back after the grace period: locks at once',[k.lock.isLocked(),k.screen.open],[true,true]);
  await settle();eq('...and unlocks again with a yes',k.lock.isLocked(),false);
  k.lock.onForeground();eq('a return with no recorded departure does not lock',k.lock.isLocked(),false);
  k=make();k.at(0);k.lock.onBackground();k.at(1e9);k.lock.onForeground();
  eq('lock off: time away never locks',k.lock.isLocked(),false);

  // the prompt pauses the app: that pause is not "time away"
  k=make({on:true,phone:{auth:[{ok:false,code:'cancelled'}]}});k.lock.start();await settle();
  k.at(10);k.lock.onBackground();k.at(10+999999);k.lock.onForeground();
  eq('locked already: coming back does not stack a second prompt',k.log.filter(x=>x.startsWith('auth:')).length,1);
  k=make({on:true});k.lock.start();
  k.at(5);k.lock.onBackground();await settle();k.at(5+999999);k.lock.onForeground();await settle();
  eq('the app pausing for the system prompt, then returning after a slow PIN, does not lock again after unlock',k.lock.isLocked(),false);

  k=make({on:true});k.lock.start();await settle();
  k.at(0);k.lock.onBackground();k.at(5000);k.lock.onForeground();k.at(60000);k.lock.onForeground();
  eq('one short absence is counted once: a second "returned" much later does not lock',k.lock.isLocked(),false);

  // the system prompt pauses the app, so the app "leaves" and "returns" while it is open: whatever the order, it must not lock itself again
  k=make({on:true,phone:{hold:true}});k.lock.start();await settle();
  k.at(100);k.lock.onBackground();k.at(100+120000);k.lock.onForeground();
  eq('a slow PIN (2 minutes): the app returns while the prompt is still open, and nothing changes',[k.lock.isLocked(),k.log.filter(x=>x.startsWith('auth:')).length],[true,1]);
  k.phone.answer();await settle();
  eq('then the right PIN opens the app',[k.lock.isLocked(),k.screen.open],[false,false]);
  k.at(100+120001);k.lock.onForeground();
  eq('a late "returned" event after the unlock does not lock again',k.lock.isLocked(),false);
  k=make({on:true,phone:{hold:true}});k.lock.start();await settle();
  k.at(100);k.lock.onBackground();k.phone.answer();await settle();k.at(100+120000);k.lock.onForeground();
  eq('"left" during the prompt, unlock, then "returned" much later: not locked again',k.lock.isLocked(),false);
  k=make({on:true,phone:{auth:[{ok:false,code:'cancelled'}]}});k.lock.start();await settle();
  k.at(0);k.lock.onBackground();k.at(999999);k.lock.onForeground();await settle();
  eq('a cancelled prompt is not asked again by a return (no prompt loop)',k.log.filter(x=>x.startsWith('auth:')).length,1);

  // ---- switching on ----
  k=make({phone:{available:false}});let r=await k.lock.enable();
  eq('cannot switch on without a screen lock on the phone',[r.ok,/tela de bloqueio/.test(r.message),k.lock.isEnabled()],[false,true,false]);
  eq('...and nothing was asked of the person',k.log.some(x=>x.startsWith('auth:')),false);
  k=make({phone:{auth:[{ok:false,code:'cancelled'}]}});r=await k.lock.enable();
  eq('switching on needs a confirmation: cancelled means still off, with no message',[r.ok,r.message,k.lock.isEnabled()],[false,'',false]);
  k=make({phone:{auth:[{ok:false,code:'lockout'}]}});r=await k.lock.enable();
  eq('a lockout on switching on is explained',[r.ok,/Aguarde/.test(r.message)],[false,true]);
  k=make();r=await k.lock.enable();
  eq('confirmed: switched on, and the capture flag is set',[r.ok,k.lock.isEnabled(),k.log.includes('secure:true')],[true,true,true]);
  eq('switching on does not lock the app that is open',k.lock.isLocked(),false);

  // ---- switching off ----
  k=make({on:true,phone:{auth:[{ok:false,code:'cancelled'}]}});r=await k.lock.disable();
  eq('switching off needs a confirmation too',[r.ok,k.lock.isEnabled()],[false,true]);
  k=make({on:true});r=await k.lock.disable();
  eq('confirmed: switched off, capture flag cleared',[r.ok,k.lock.isEnabled(),k.log.includes('secure:false')],[true,false,true]);
  return res;};

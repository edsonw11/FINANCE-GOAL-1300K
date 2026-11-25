/**
 * tests/fixtures/fake-native.js
 * Responsibility: a scripted Capacitor for the browser test of the Android shell (installed before the app starts): it says "native platform",
 * records what the app asks of the Filesystem and Share plugins, counts network calls, and collects CSP violations.
 */
(function(){
  const log={backHandlers:[],exits:0,writes:[],shares:[],fetches:[],violations:[],failWrite:false,cancelShare:false,stateHandlers:[],clock:0,
    lock:{available:true,result:'ok',calls:[],secure:null}};
  window.__native=log;
  // the app lock's clock can be moved forward, so "away for 30 seconds" does not take 30 seconds
  const realNow=Date.now;Date.now=()=>realNow.call(Date)+log.clock;
  // "#locked": the lock was switched on in an earlier run, and the person cancels the first prompt
  if(location.hash==='#locked'){localStorage.setItem('metaapp.lock','1');log.lock.result='cancelled';}
  document.addEventListener('securitypolicyviolation',e=>log.violations.push(e.violatedDirective+' '+(e.blockedURI||'')));
  const realFetch=window.fetch;
  window.fetch=function(u){log.fetches.push(String(u));return realFetch.apply(this,arguments);};
  window.Capacitor={isNativePlatform:()=>true,Plugins:{
    Filesystem:{writeFile:async o=>{if(log.failWrite)throw new Error('disk full');log.writes.push(o);return {uri:'file:///cache/'+o.path};}},
    App:{addListener:(n,fn)=>{if(n==='backButton')log.backHandlers.push(fn);if(n==='appStateChange')log.stateHandlers.push(fn);},exitApp:()=>{log.exits++;}},
    AppLock:{
      status:async()=>({available:log.lock.available,reason:log.lock.available?'':'none-enrolled'}),
      authenticate:async o=>{log.lock.calls.push(o.title);if(log.lock.result!=='ok'){const e=new Error('no');e.code=log.lock.result;throw e;}},
      setSecure:async o=>{log.lock.secure=o.secure;}},
    Share:{share:async o=>{if(log.cancelShare)throw new Error('Share canceled');log.shares.push(o);}}}};
})();

/**
 * tests/fixtures/fake-native.js
 * Responsibility: a scripted Capacitor for the browser test of the Android shell (installed before the app starts): it says "native platform",
 * records what the app asks of the Filesystem and Share plugins, counts network calls, and collects CSP violations.
 */
(function(){
  const log={writes:[],shares:[],fetches:[],violations:[],failWrite:false,cancelShare:false};
  window.__native=log;
  document.addEventListener('securitypolicyviolation',e=>log.violations.push(e.violatedDirective+' '+(e.blockedURI||'')));
  const realFetch=window.fetch;
  window.fetch=function(u){log.fetches.push(String(u));return realFetch.apply(this,arguments);};
  window.Capacitor={isNativePlatform:()=>true,Plugins:{
    Filesystem:{writeFile:async o=>{if(log.failWrite)throw new Error('disk full');log.writes.push(o);return {uri:'file:///cache/'+o.path};}},
    Share:{share:async o=>{if(log.cancelShare)throw new Error('Share canceled');log.shares.push(o);}}}};
})();

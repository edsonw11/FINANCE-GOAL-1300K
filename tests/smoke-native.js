/**
 * tests/smoke-native.js
 * Responsibility: browser scenario for the Android shell. The page is mobile/www/index.html (the one with its own Content-Security-Policy) with a scripted Capacitor
 * (fixtures/fake-native.js). Checks: the app runs under that policy with no violation, makes no network call, hides the sync, and a backup leaves through the share sheet.
 */
(async function(){
  const errs=[],out=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message));
  const $=id=>document.getElementById(id),q=s=>document.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const step=async(n,f)=>{try{await f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}document.documentElement.setAttribute('data-smoke',out.concat(errs,['…running']).join(' | '));};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  const N=window.__native,LAST='metaapp.lastBackup';
  await wait(400);
  const L=N.lock,toggle=()=>$('lockToggle'),stored=()=>localStorage.getItem('metaapp.lock');
  if(location.hash==='#locked'){
    // the lock was on in an earlier run: the app starts locked, and the first prompt is cancelled
    await step('starts locked: the lock screen is over the app and the phone was asked once',async()=>{
      need($('lockDlg').open,'the lock screen is not open');need(L.calls.length===1,'prompts: '+L.calls.length);need(L.secure===true,'recent-apps protection not set');});
    await step('a cancelled prompt leaves it locked, with a message and the button',async()=>{
      need($('lockDlg').open,'unlocked by a cancel');need(/cancelado/.test($('lockMsg').textContent),'message: '+$('lockMsg').textContent);need($('lockRetry').offsetParent!==null,'button not visible');});
    await step('the lock screen cannot be dismissed with Esc or the system Back',async()=>{
      const ev=new Event('cancel',{cancelable:true});$('lockDlg').dispatchEvent(ev);need(ev.defaultPrevented,'cancel not prevented');
      const exits=N.exits;N.backHandlers.forEach(f=>f());await wait(60);need(N.exits===exits+1,'Back did not leave the app');need($('lockDlg').open,'Back closed the lock');});
    await step('the button asks again; a yes opens the app',async()=>{
      L.result='ok';$('lockRetry').click();await wait(120);need(!$('lockDlg').open,'still locked after a yes');need(L.calls.length===2,'prompts: '+L.calls.length);});
    await step('away for a short time: no new lock',async()=>{
      N.stateHandlers.forEach(f=>f({isActive:false}));N.clock+=10000;N.stateHandlers.forEach(f=>f({isActive:true}));await wait(60);need(!$('lockDlg').open,'locked after 10 s');});
    await step('away for 30 seconds: locks again and asks at once',async()=>{
      N.stateHandlers.forEach(f=>f({isActive:false}));N.clock+=31000;N.stateHandlers.forEach(f=>f({isActive:true}));await wait(150);
      need(L.calls.length===3,'prompts: '+L.calls.length);need(!$('lockDlg').open,'a yes should have opened it again');});
    await step('with a cancel, the lock stays over an open sheet',async()=>{
      $('fab').click();await wait(150);need($('sheet').open,'sheet did not open');
      L.result='cancelled';N.stateHandlers.forEach(f=>f({isActive:false}));N.clock+=31000;N.stateHandlers.forEach(f=>f({isActive:true}));await wait(150);
      need($('lockDlg').open,'the lock is not shown');for(const [x,y] of [[0.5,0.5],[0.5,0.9],[0.1,0.1]]){const e=document.elementFromPoint(innerWidth*x,innerHeight*y);need(e&&e.closest('#lockDlg'),'the lock does not cover the point '+x+','+y+': '+(e&&(e.id||e.tagName)));}});
    await step('the Ajustes card, with the lock on, offers to switch it off; switching off needs a yes',async()=>{
      L.result='ok';$('lockRetry').click();await wait(120);$('shClose').click();q('#nav [data-t=cfg]').click();await wait(80);
      need(!$('lockCard').hidden&&/Desativar/.test(toggle().textContent),'card: '+toggle().textContent);
      const before=L.calls.length;L.result='cancelled';toggle().click();await wait(120);
      need(stored()==='1'&&L.calls.length===before+1,'a cancel switched it off');
      L.result='ok';toggle().click();await wait(120);
      need(stored()===null&&L.secure===false,'not switched off: '+stored()+' '+L.secure);need(/Ativar/.test(toggle().textContent),'button not redrawn');});
    await step('no violation and no script error',async()=>{need(N.violations.length===0,N.violations.join(', '));need(!errs.length,errs.join(';'));});
    document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
    return;
  }
  await step('the app starts under its own policy: no violation, no error',async()=>{need(N.violations.length===0,'violations: '+N.violations.join(', '));need(!errs.length,errs.join(';'));need(document.querySelectorAll('#nav button').length>=5,'the app did not draw');});
  await step('the policy is really in the page (so the test would catch a violation)',async()=>{
    const m=document.querySelector('meta[http-equiv="Content-Security-Policy"]');need(m,'no CSP meta');need(/connect-src 'none'/.test(m.content),'network not closed');need(/script-src 'self' 'sha256-/.test(m.content),'scripts not pinned by hash');});
  await step('the sync is out of the way: no card, no badge, no call to the API',async()=>{
    await wait(200);need($('syncCard').hidden,'sync card shown');need($('syncBadge').hidden,'sync badge shown');need(!N.fetches.some(u=>/\/api\/|\/auth\//.test(u)),'API called: '+N.fetches.join(','));});
  await step('the app works offline: test data appears in the list',async()=>{
    $('demoOn').click();await wait(300);q('#nav [data-t=lanc]').click();await wait(100);need(document.querySelectorAll('[data-tx]').length>5,'no rows');});
  await step('a backup goes through the share sheet, with the whole state, and counts as done',async()=>{
    localStorage.removeItem(LAST);$('exp').click();await wait(200);
    need(N.writes.length===1&&N.shares.length===1,'writes '+N.writes.length+' shares '+N.shares.length);
    const data=JSON.parse(N.writes[0].data);need(Array.isArray(data.tx)&&data.tx.length>5&&data.goal,'backup content is not the state');
    need(N.writes[0].directory==='CACHE'&&/\.json$/.test(N.writes[0].path),'wrong file place or name');
    need(N.shares[0].url==='file:///cache/'+N.writes[0].path,'share does not point at the file');need(localStorage.getItem(LAST),'backup not recorded');});
  await step('closing the share sheet is not an error and does not count as a backup',async()=>{
    localStorage.removeItem(LAST);N.cancelShare=true;$('exp').click();await wait(200);N.cancelShare=false;
    need(!localStorage.getItem(LAST),'a cancelled backup was recorded');need(!/Não foi possível/.test($('toast').textContent),'cancel shown as an error');});
  await step('a write failure is told to the person and does not count as a backup',async()=>{
    localStorage.removeItem(LAST);N.failWrite=true;$('exp').click();await wait(200);N.failWrite=false;
    need(!localStorage.getItem(LAST),'a failed backup was recorded');need(/Não foi possível salvar o backup: disk full/.test($('toast').textContent),'no message: '+$('toast').textContent);});
  const back=async()=>{N.backHandlers.forEach(f=>f());await wait(80);};
  await step('the Back button: listener is registered once',async()=>{need(N.backHandlers.length===1,'listeners: '+N.backHandlers.length);});
  await step('Back closes a sheet, and cancels a confirmation without confirming it',async()=>{
    q('#nav [data-t=lanc]').click();await wait(100);q('[data-tx]').click();await wait(200);need($('sheet').open,'sheet did not open');
    const exits=N.exits;await back();need(!$('sheet').open,'Back did not close the sheet');need(N.exits===exits,'Back left the app with a sheet open');
    // a confirmation of the app (test data already exist, so it asks before replacing them) is answered by Back, and nothing is replaced
    const before=localStorage.getItem('metaapp.v2');$('demoOn').click();await wait(200);need($('confirmDlg').open,'confirmation not shown');
    await back();need(!$('confirmDlg').open,'Back should close the confirmation');need(localStorage.getItem('metaapp.v2')===before,'Back confirmed instead of cancelling');});
  await step('Back from another tab goes to the summary, and from the summary leaves the app',async()=>{
    q('#nav [data-t=cfg]').click();await wait(100);const exits=N.exits;
    await back();need(q('#nav button.on').dataset.t==='resumo','Back did not go to the summary: '+q('#nav button.on').dataset.t);need(N.exits===exits,'left too early');
    await back();need(N.exits===exits+1,'Back on the summary did not leave the app');});
  await step('Ajustes: the lock card is there, and a phone with no screen lock cannot switch it on',async()=>{
    q('#nav [data-t=cfg]').click();await wait(80);need(!$('lockCard').hidden&&/Ativar/.test(toggle().textContent),'card not shown');
    L.available=false;toggle().click();await wait(120);L.available=true;
    need(stored()===null,'switched on without a screen lock');need(/tela de bloqueio/.test($('toast').textContent),'no explanation: '+$('toast').textContent);need(L.calls.length===0,'asked the person anyway');});
  await step('switching on needs a yes: a cancel keeps it off, a yes turns it on and protects the recent apps',async()=>{
    L.result='cancelled';toggle().click();await wait(120);need(stored()===null,'a cancel switched it on');
    L.result='ok';toggle().click();await wait(120);need(stored()==='1','not switched on');need(L.secure===true,'recent-apps protection not set');
    need(!$('lockDlg').open,'switching on locked the app that was open');need(/Desativar/.test(toggle().textContent),'button not redrawn');});
  await step('the lock on a phone that lost its screen lock switches itself off instead of locking the person out',async()=>{
    L.available=false;N.stateHandlers.forEach(f=>f({isActive:false}));N.clock+=31000;N.stateHandlers.forEach(f=>f({isActive:true}));await wait(150);L.available=true;
    need(!$('lockDlg').open,'the person was locked out');need(stored()===null,'the lock stayed on');need(L.secure===false,'protection stayed on');});
  await step('still no violation after all of that',async()=>{need(N.violations.length===0,N.violations.join(', '));});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

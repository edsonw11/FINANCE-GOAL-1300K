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
  await step('still no violation after all of that',async()=>{need(N.violations.length===0,N.violations.join(', '));});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

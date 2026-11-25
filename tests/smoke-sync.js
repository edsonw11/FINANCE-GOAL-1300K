/**
 * tests/smoke-sync.js
 * Responsibility: browser scenario for the sync card (Settings → Conta e sincronização) against the scripted API of fixtures/fake-api.js; writes the result to <html data-smoke="...">.
 */
(async function(){
  const errs=[],out=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
  window.addEventListener('unhandledrejection',e=>errs.push('ERR rejection '+JSON.stringify(e.reason)));
  const $=id=>document.getElementById(id),q=s=>document.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(f,m)=>{for(let i=0;i<200;i++){if(f())return;await wait(25);}throw new Error('timeout: '+m);};
  const step=async(n,f)=>{try{await f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}document.documentElement.setAttribute('data-smoke',out.concat(errs,['…running']).join(' | '));};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  const fake=window.__fake,signedOut=new URLSearchParams(location.hash.slice(1)).has('signedout');
  const addExpense=async(value,desc)=>{
    $('fab').click();await wait(0);const r=q('input[name=tp][value=despesa]');r.checked=true;r.dispatchEvent(new Event('change'));
    $('fVal').value=value;$('fCat').value='Mercado';$('fFonte').value='caixa';$('fDesc').value=desc;$('fSave').click();await wait(0);
    if($('confirmDlg').open)$('cfOk').click();await wait(0);if($('sheet').open)$('shClose').click();};
  q('#nav [data-t=cfg]').click();
  if(signedOut){
    await step('signed out: the card offers "Entrar" and nothing else',async()=>{
      await until(()=>!$('syncCard').hidden,'card shown');
      need(/Entrar/.test($('syncBody').textContent),'no sign-in button');need(!$('syncNow'),'sync button shown while signed out');
      need($('syncBadge').hidden,'badge shown while signed out');need(q('#syncLogin').getAttribute('href').startsWith('/auth/login?returnTo='),'wrong login address');});
  }else{
    await step('signed in: shows who, the plan, and that everything is sent',async()=>{
      await until(()=>$('syncStatus')&&/Tudo enviado/.test($('syncStatus').textContent),'first sync done');
      need(/ana@example\.test/.test($('syncBody').textContent),'no e-mail');need(/Gratuito/.test($('syncBody').textContent),'no plan');
      need(!$('syncBadge').hidden&&/em dia/.test($('syncBadge').textContent),'badge: '+$('syncBadge').textContent);});
    await step('an expense makes the badge say "1 pendente", and "Sincronizar" sends it',async()=>{
      fake.down=true;await addExpense('R$ 42,00','sync smoke');
      await until(()=>/1 pendente/.test($('syncBadge').textContent),'pending badge');
      $('syncNow').click();await until(()=>/Sem conexão/.test($('toast').textContent),'offline message');
      need(/1 pendente/.test($('syncBadge').textContent),'pending lost after a failed sync');
      fake.down=false;$('syncNow').click();
      await until(()=>/Tudo enviado/.test($('syncStatus').textContent),'sent');
      const sent=fake.pushes.filter(m=>m.resource==='tx'&&m.op==='put');need(sent.length===1&&sent[0].data.body.value===42,'server did not get the expense once: '+JSON.stringify(fake.pushes.map(m=>m.resource)));
      need(/em dia/.test($('syncBadge').textContent),'badge not "em dia"');});
    await step('what another device did appears in the list after "Sincronizar"',async()=>{
      fake.addRemote('tx','22222222-2222-4222-8222-222222222222',{id:900,type:'despesa',date:new Date().toLocaleDateString('sv'),value:7.5,cat:'Mercado',desc:'from the tablet',fonte:'caixa'},'900');
      $('syncNow').click();await until(()=>!$('syncNow').disabled&&/from the tablet/.test(document.body.textContent),'remote expense on screen');
      q('#nav [data-t=cfg]').click();});
    await step('signing out hides the sync and keeps the data',async()=>{
      q('#nav [data-t=cfg]').click();$('syncLogout').click();await until(()=>$('syncLogin'),'login button');
      need(fake.logouts===1,'logout not sent');need($('syncBadge').hidden,'badge still shown');need(/from the tablet/.test(document.body.textContent),'data gone after logout');});
  }
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

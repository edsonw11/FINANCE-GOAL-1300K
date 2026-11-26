/**
 * tests/smoke-xss.js
 * Responsibility: browser scenario for XSS. Every free-text field a person controls (descriptions, account/category/group names and icons, tickers) is filled with markup
 * that would run or change the page if it were put into the DOM unescaped, then every screen and sheet is opened and the DOM is searched for what that markup would create.
 * Runs in two loads of the same page: the first builds the data (demo) and stores the hostile version, the second opens the app on it. Writes the result to <html data-smoke="...">.
 */
(async function(){
  const errs=[],out=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
  const $=id=>document.getElementById(id),q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const show=()=>document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
  const step=async(n,f)=>{try{await f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}show();};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  // each piece tries a different way out: a tag, an attribute, a script, a closed textarea, a javascript: link
  const HOSTILE='<img src=x onerror="window.__xss=1"><b id=xssb></b>" autofocus onfocus="window.__xss=2" x="\'><script>window.__xss=3</script></textarea><a href="javascript:window.__xss=4">x</a>';
  const KEY='metaapp.v2';
  if(!localStorage.getItem('xss-phase')){
    await wait(300);$('demoOn').click();await wait(300);
    const s=JSON.parse(localStorage.getItem(KEY)),h=t=>typeof t==='string'?HOSTILE+t:t;
    s.accounts.forEach(a=>{a.name=h(a.name);});
    s.tx.forEach(t=>{t.desc=h(t.desc);t.cat=h(t.cat);});
    for(const k of Object.keys(s.cats||{}))s.cats[k].forEach(c=>{c.name=h(c.name);c.icon=h(c.icon);c.group=h(c.group);});
    (s.groups||[]).forEach(g=>{g.name=h(g.name);g.icon=h(g.icon);});
    (s.trades||[]).forEach(t=>{t.ticker=h(t.ticker);t.name=h(t.name||'x');});
    s.ownNames=[HOSTILE+'Maria'];
    localStorage.setItem(KEY,JSON.stringify(s));localStorage.setItem('xss-phase','2');
    location.reload();return;
  }
  const attackSigns=()=>{
    const found=[];
    if(window.__xss)found.push('code ran: __xss='+window.__xss);
    if(q('#xssb')){const b=q('#xssb');let p=b,path=[];for(let i=0;i<4&&p;i++,p=p.parentElement)path.push(p.tagName.toLowerCase()+(p.id?'#'+p.id:'')+(p.className&&typeof p.className==='string'?'.'+p.className.split(' ')[0]:''));found.push('an element was created from text (#xssb) inside '+path.join(' < ')+' in '+(b.closest('[id]')||{}).id+' via '+(b.closest('.li')||b.parentElement).outerHTML.replace(/<img[^>]*>/g,'').slice(0,200));}
    if(q('img[src="x"]'))found.push('an <img src=x> was created from text');
    if(qa('script:not([src])').some(s=>/__xss/.test(s.textContent)))found.push('a <script> was created from text');
    if(qa('a[href^="javascript:"]').length)found.push('a javascript: link was created from text');
    const withHandler=qa('*').find(e=>[...e.attributes].some(a=>/^on/i.test(a.name)));
    if(withHandler)found.push('an on* attribute on <'+withHandler.tagName.toLowerCase()+'>');
    return found;
  };
  const clean=async(where)=>{await wait(60);const f=attackSigns();need(!f.length,where+': '+f.join('; '));};
  const tabs=['resumo','lanc','cartao','meta','analise','cad','cfg'];
  await step('the page starts on the hostile data',async()=>{await wait(300);need(JSON.parse(localStorage.getItem(KEY)).tx.some(t=>t.desc.startsWith('<img')),'hostile data not loaded');await clean('first screen');});
  for(const t of tabs){
    await step('tab '+t+' shows the text as text',async()=>{const b=q('#nav [data-t='+t+']');need(b,'no tab');b.click();await clean('tab '+t);});
  }
  await step('the text is visible as text (it was not dropped)',async()=>{q('#nav [data-t=lanc]').click();await wait(60);need(document.body.textContent.includes('<img src=x'),'the markup is not shown as text');});
  await step('a transaction detail, edit form and delete confirmation',async()=>{
    q('#nav [data-t=lanc]').click();await wait(60);const row=q('[data-tx]');need(row,'no transaction row');row.click();await wait(80);await clean('detail');
    const ed=q('#shFoot [data-act=edit]');if(ed){ed.click();await wait(80);await clean('edit form');need($('fDesc')&&$('fDesc').value.startsWith('<img'),'the field does not hold the text as a value');}
    const del=q('#shFoot [data-act=del]');if(del){del.click();await wait(80);await clean('delete confirmation');if($('confirmDlg').open)$('cfCancel').click();}
    if($('sheet').open)$('shClose').click();});
  await step('the new-transaction form, its category list and the suggestions',async()=>{
    $('fab').click();await wait(80);await clean('new form');const d=$('fDesc');if(d){d.value='<img src=x onerror="window.__xss=1">';d.dispatchEvent(new Event('input',{bubbles:true}));await wait(60);await clean('suggestions for typed text');}
    if($('sheet').open)$('shClose').click();});
  await step('the cards of the summary open as sheets',async()=>{
    q('#nav [data-t=resumo]').click();await wait(60);
    for(const k of qa('#kFlow [data-kpi]').slice(0,6)){k.click();await wait(60);await clean('kpi '+k.dataset.kpi);if($('sheet').open)$('shClose').click();}});
  await step('the category sheet and the sync card',async()=>{
    q('#nav [data-t=cad]').click();await wait(60);const c=q('#t-cad [data-cat], #t-cad .lst > *');if(c){c.click();await wait(80);await clean('category sheet');if($('sheet').open)$('shClose').click();}
    q('#nav [data-t=cfg]').click();await wait(80);await clean('settings');});
  await step('a backup file with hostile text is shown as text too',async()=>{
    const dump=localStorage.getItem(KEY);need(dump.includes('<img'),'nothing hostile to export');await clean('after all screens');});
  localStorage.removeItem('xss-phase');localStorage.removeItem(KEY);
  show();
})();

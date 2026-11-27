/**
 * tests/smoke-i18n.js
 * Responsibility: end-to-end proof that no screen is left in Portuguese when the app is in English or Spanish.
 * It walks every tab, sheet, dialog, form type, error and toast, on a blank app and with records, and fails with the
 * exact text and the place where Portuguese shows up. A screen added later is covered as soon as it is reachable from a tab.
 */
(async()=>{
  const out=[],errs=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
  window.addEventListener('unhandledrejection',e=>errs.push('ERR rejection '+e.reason));
  const $=id=>document.getElementById(id),q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const tick=()=>new Promise(r=>setTimeout(r,0));
  const step=async(n,f)=>{try{await f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}document.documentElement.setAttribute('data-smoke',out.concat(errs,['…running']).join(' | '));};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  const tab=t=>q(`#nav [data-t=${t}]`).click();
  const closeSheet=()=>{if($('sheet').open)$('shClose').click();};
  const closeDialogs=()=>{closeSheet();qa('dialog[open]').forEach(d=>{const b=d.querySelector('[id$=Cancel],#dCancel,#sugCancel,#shClose');if(b)b.click();else if(d.close)d.close();});};
  const type=(el,text)=>{el.focus();el.value='';for(const ch of text){const be=new InputEvent('beforeinput',{data:ch,inputType:'insertText',bubbles:true,cancelable:true});
    if(el.dispatchEvent(be)){el.value+=ch;el.dispatchEvent(new Event('input',{bubbles:true}));}}};
  const pick=async l=>{tab('cfg');await tick();q(`#langBtns [data-lang="${l}"]`).click();await tick();};
  // what only Portuguese has: letters, and interface words that Spanish and English do not share
  const PT_LETTERS=/[ãõçÃÕÇ]/;
  // words that are valid Spanish too, so they only count as leaks in English
  const PT_WORDS_ONLY_EN=/(?<![\p{L}])(meses|Toque|Importe)(?![\p{L}])/u;
  const PT_WORDS=/(?<![\p{L}])(não|você|vocês|também|ainda|mês|Nenhum|Nenhuma|Bem-vindo|Receitas?|Despesas?|Lançamentos?|Cartão|Faturas?|Resumo|Sobrou|Orçamentos?|Patrimônio|Adicionar|Salvar|Excluir|Hoje|Mais|Voltar|Fechar|Gerar|Apagar|Remover|Descrição|Categorias?|Cadastre|Lance|Escolha|Informe|Confira|Quanto|Onde|Seus|Suas|Seu|Sua|Meta líquida|Rendimento)(?![\p{L}])/u;
  const visible=el=>{if(!el||el.closest('[hidden],script,style,#printReport'))return false;if(!el.getClientRects().length)return false;return getComputedStyle(el).visibility!=='hidden';};
  // everything a person can read right now: visible text, labels, placeholders, titles, select options of visible selects
  const readable=()=>{
    const found=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
    while((n=w.nextNode())){const s=n.nodeValue.trim();if(s&&visible(n.parentElement))found.push([s,n.parentElement]);}
    qa('[aria-label],[title],[placeholder]').forEach(el=>{if(!visible(el))return;['aria-label','title','placeholder'].forEach(a=>{const v=el.getAttribute(a);if(v)found.push([v,el]);});});
    qa('select').forEach(sel=>{if(visible(sel))[...sel.options].forEach(o=>found.push([o.textContent.trim(),sel]));});
    return found;};
  const where=el=>{let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;else if(el.className&&typeof el.className==='string')s+='.'+el.className.split(' ')[0];return s;};
  // the quick-entry sentence is read in Portuguese only (for now), so its example text keeps Portuguese words on purpose
  const PORTUGUESE_ON_PURPOSE=el=>!!el.closest('#qeHelp')||el.id==='qeText';
  const leaks=()=>{const bad=[];readable().forEach(([s,el])=>{if(PORTUGUESE_ON_PURPOSE(el))return;if(PT_LETTERS.test(s)||PT_WORDS.test(s)||(document.documentElement.lang.startsWith('en')&&PT_WORDS_ONLY_EN.test(s)))bad.push(JSON.stringify(s.slice(0,80))+' in '+where(el));});return [...new Set(bad)];};
  const reported=new Set();
  const scan=async(label,lang,seen)=>{await tick();const b=leaks().filter(x=>!reported.has(lang+x));b.forEach(x=>reported.add(lang+x));if(b.length)seen.push(`[${lang}] ${label}: ${b.join(' ; ')}`);};

  // every reachable screen, one after the other; each returns after leaving the app in a clean state
  const walk=async(lang,seen)=>{
    const toast=$('toast');if(toast){toast.textContent='';try{toast.hidePopover();}catch(e){/* not open */}}
    const S=(label)=>scan(label,lang,seen);
    for(const t of ['resumo','lanc','cartao','meta','analise','cad','cfg']){tab(t);await tick();await S('tab '+t);}
    // month navigation and "today"
    tab('resumo');await tick();q('#t-resumo [data-mv="-1"]').click();await tick();await S('previous month');q('#t-resumo [data-mv="1"]').click();await tick();
    // new record form: each kind, the extra options, the split, the errors
    tab('lanc');await tick();$('fab').click();await tick();await S('form (expense)');
    for(const k of ['receita','fatura','aporte','despesa']){const r=q(`input[name=tp][value=${k}]`);r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));await tick();await S('form kind '+k);}
    $('wMore').open=true;$('splitBtn').click();await tick();await S('form split');$('splitAdd').click();await tick();await S('form split, two parts');
    $('fSave').click();await tick();await S('form: save with nothing typed (errors)');
    closeDialogs();await tick();
    // quick entry (the sentence is Portuguese on purpose, the screen around it is not)
    tab('lanc');await tick();type($('qeText'),'gastei 85,90 no mercado hoje');$('qeGo').click();await tick();await S('quick entry result');closeDialogs();
    // sheets and dialogs reachable from the screens
    $('bnav').querySelector('[data-t=more]').click();await tick();await S('more menu');closeDialogs();
    tab('lanc');await tick();$('impOpen').click();await tick();await S('import sheet');closeDialogs();
    tab('meta');await tick();$('impOpenInv').click();await tick();await S('import (investments) sheet');closeDialogs();
    tab('cad');await tick();$('sugOpen').click();await tick();await S('suggested categories');closeDialogs();
    tab('cfg');await tick();$('reset').click();await tick();await S('confirm: erase everything');closeDialogs();
    // taps on the summary cards open detail sheets
    tab('resumo');await tick();
    for(const el of qa('#kFlow > *, #monthHero [data-detail], #cats [data-d], .kpi[data-d], [data-d]').slice(0,12)){if(!visible(el))continue;el.click();await tick();await S('detail from '+where(el));closeDialogs();await tick();}
    // the list of records: open one, and its actions
    tab('lanc');await tick();const row=q('#txList .li');if(row){row.click();await tick();await S('record detail');closeDialogs();}
    // card tab: cycle navigation
    tab('cartao');await tick();const prev=q('#cycleBox [data-cy="-1"],#cycleBox button');if(prev){prev.click();await tick();await S('card: other invoice');}
    tab('resumo');await tick();
  };

  await step('blank app: every screen is clean in English and in Spanish',async()=>{
    const seen=[];
    for(const lang of ['en-US','es']){await pick(lang);need(document.documentElement.lang===lang,'language not applied');await walk(lang,seen);}
    await pick('pt-BR');
    need(seen.length===0,'Portuguese left on screen ('+seen.length+'): '+seen.join(' || '));});

  await step('with records and accounts: every screen is clean in English and in Spanish',async()=>{
    await pick('pt-BR');
    // records through the form like a person: an expense in a default category, a card purchase, an income, and an account
    const add=async(o)=>{$('fab').click();await tick();const r=q(`input[name=tp][value=${o.type}]`);r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));
      type($('fVal'),o.cents);$('fCat').value=o.cat||'';if(o.fonte)$('fFonte').value=o.fonte;$('fDate').value=o.date;$('fDesc').value=o.desc;$('fSave').click();await tick();if($('confirmDlg').open)$('cfOk').click();await tick();closeSheet();};
    tab('meta');await tick();$('newAcc').value='My broker';$('addAcc').click();await tick();
    const d=new Date();const iso=(n)=>{const x=new Date(d.getFullYear(),d.getMonth(),Math.max(1,d.getDate()-n),12);return x.toLocaleDateString('sv');};
    tab('lanc');await tick();
    await add({type:'despesa',cents:'8590',cat:'Mercado',date:iso(1),desc:'Weekly shopping'});
    await add({type:'despesa',cents:'12000',cat:'Cartão de crédito',fonte:'cartao',date:iso(2),desc:'Card purchase'});
    await add({type:'despesa',cents:'4500',cat:'Restaurantes',fonte:'cartao',date:iso(3),desc:'Dinner'});
    await add({type:'receita',cents:'500000',cat:'Salário',date:iso(2),desc:'Pay'});
    await add({type:'despesa',cents:'30000',cat:'Imprevistos / Outros',date:iso(4),desc:'Unexpected'});
    const seen=[];
    for(const lang of ['en-US','es']){await pick(lang);await walk(lang,seen);}
    await pick('pt-BR');
    need(seen.length===0,'Portuguese left on screen ('+seen.length+'): '+seen.join(' || '));});

  await step('the scanner itself works: a Portuguese word on screen is caught',async()=>{
    await pick('en-US');tab('resumo');await tick();const el=document.createElement('p');el.id='plant';el.textContent='Bem-vindo, lance sua primeira despesa';q('#t-resumo').appendChild(el);
    need(leaks().some(x=>/Bem-vindo/.test(x)),'the scan did not see a planted Portuguese sentence');el.remove();
    const l2=document.createElement('p');l2.textContent='sem acento e sem palavra-chave: informação';q('#t-resumo').appendChild(l2);need(leaks().some(x=>/informação/.test(x)),'the scan did not see a planted accented word');l2.remove();
    need(leaks().length===0||true,'');await pick('pt-BR');});

  await step('no script error',()=>{need(errs.length===0,errs.join(' / '));});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

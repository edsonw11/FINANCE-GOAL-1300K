/**
 * tests/smoke-flows.js
 * Responsibility: end to end scenario for the flows that move money, on a BLANK app (no test data), driven only through the screens: settings that change the card
 * and the projection, a balance typed by hand, a series of monthly records and "apply to the next ones", a split inside the new-record form, paying a card invoice
 * in each of its ways, and the advanced invoice form. Each step checks what is shown AND what is stored. Writes the result to <html data-smoke="...">.
 * Dates of records are fixed in the past, so the scenario does not depend on the day it runs.
 */
(async function(){
  const errs=[],out=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
  window.addEventListener('unhandledrejection',e=>errs.push('ERR rejection '+e.reason));
  const $=id=>document.getElementById(id),q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const tick=()=>new Promise(r=>setTimeout(r,0));
  const step=async(n,f)=>{try{await f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}document.documentElement.setAttribute('data-smoke',out.concat(errs,['…running']).join(' | '));};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(m+': got '+JSON.stringify(a)+', expected '+JSON.stringify(b));};
  const stored=()=>JSON.parse(localStorage.getItem('metaapp.v2'));
  const type=(el,text)=>{el.focus();el.value='';for(const ch of text){const be=new InputEvent('beforeinput',{data:ch,inputType:'insertText',bubbles:true,cancelable:true});
    if(el.dispatchEvent(be)){el.value+=ch;el.dispatchEvent(new Event('input',{bubbles:true}));}}};
  const change=(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
  const confirmYes=async()=>{await tick();need($('confirmDlg').open,'confirmation not shown');$('cfOk').click();await tick();};
  const tab=t=>q(`#nav [data-t=${t}]`).click();
  const round=n=>Math.round(n*100)/100;
  const realTick=()=>new Promise(r=>{const i=new Image();i.onload=i.onerror=()=>r();i.src='tick-'+Math.random()+'.png';});
  const waitFor=async(f,what,max)=>{for(let i=0;i<(max||600);i++){if(f())return;await Promise.all([realTick(),new Promise(r=>setTimeout(r,5))]);}throw new Error('timeout: '+what);};
  const sendFile=async(name,text)=>{const dt=new DataTransfer();dt.items.add(new File([text],name,{type:'text/plain'}));const i=$('impFile');i.files=dt.files;i.dispatchEvent(new Event('change'));if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>$('impSend')&&$('impDrop').textContent.includes(name),'send button');$('impSend').click();};
  const closeSheet=()=>{if($('sheet').open)$('shClose').click();};
  // a new record through the form, like a person: kind, value (masked), category, source, date, description
  const addRecord=async(o)=>{$('fab').click();await tick();const r=q(`input[name=tp][value=${o.type||'despesa'}]`);r.checked=true;r.dispatchEvent(new Event('change'));
    type($('fVal'),o.cents);$('fCat').value=o.cat||'Mercado';if(o.fonte)$('fFonte').value=o.fonte;$('fDate').value=o.date;$('fDesc').value=o.desc||'';if(o.rep)$('fRep').value=String(o.rep);
    $('fSave').click();await tick();if($('confirmDlg').open)$('cfOk').click();await tick();closeSheet();};

  // ---- 1. Settings that move the card and the projection --------------------------------------------------------------------------------------------------
  await step('settings: best day and due day decide which invoice a purchase goes to',async()=>{
    tab('cfg');
    change($('cClose'),'10');change($('cDue'),'28');
    same([stored().card.best,stored().card.due],[10,28],'card settings stored');
    await addRecord({cents:'10000',fonte:'cartao',date:'2026-03-20',desc:'compra A'});
    // best day 10: the cycle closes on 9 April; due on 28 April
    q('#fab').click();await tick();q('input[name=tp][value=fatura]').checked=true;q('input[name=tp][value=fatura]').dispatchEvent(new Event('change'));
    same(qa('#payBox [data-pa]').map(e=>e.dataset.pa),['2026-04'],'invoice for best day 10, due 28');
    closeSheet();
    tab('cfg');change($('cClose'),'25');
    q('#fab').click();await tick();q('input[name=tp][value=fatura]').checked=true;q('input[name=tp][value=fatura]').dispatchEvent(new Event('change'));
    same(qa('#payBox [data-pa]').map(e=>e.dataset.pa),['2026-03'],'the same purchase with best day 25 closes on 24 March: invoice of 28 March');
    closeSheet();
    need(stored().tx.length===1&&stored().tx[0].value===100,'the purchase itself did not change');});
  await step('settings: the planned contribution and the yield change the projection and are stored',async()=>{
    tab('cfg');change($('rate'),'12');change($('planned'),'R$ 3.000,00');
    same([stored().rate,stored().planned],[12,3000],'stored');
    q('#bnav [data-t=meta]').click();const msg1=$('paceMsg').textContent+'|'+$('projTbl').textContent;
    tab('cfg');change($('planned'),'R$ 500,00');q('#bnav [data-t=meta]').click();const msg2=$('paceMsg').textContent+'|'+$('projTbl').textContent;
    need(msg1!==msg2,'the projection did not change with the planned contribution');
    tab('cfg');need($('planned').value==='R$ 500,00','field shows what was stored: '+$('planned').value);});

  // ---- 2. A balance typed by hand ------------------------------------------------------------------------------------------------------------------------------
  await step('balances: a typed balance is stored, shown, and typing it again replaces it (no duplicate)',async()=>{
    q('#bnav [data-t=meta]').click();
    $('newAcc').value='Conta Teste';$('addAcc').click();await tick();
    const acc=stored().accounts.find(a=>a.name==='Conta Teste');need(acc,'account not created');
    $('snapDate').value='2026-03-31';$('snapDate').dispatchEvent(new Event('change',{bubbles:true}));
    change($('s_'+acc.id),'1.000,00');$('snapSave').click();await tick();
    let snaps=stored().snaps.filter(s=>s.acc===acc.id);
    same(snaps.map(s=>[s.date,s.value]),[['2026-03-31',1000]],'stored balance');
    // the date field shows today again after drawing: set the same date and a new value
    $('snapDate').value='2026-03-31';change($('s_'+acc.id),'1.500,00');$('snapSave').click();await tick();
    snaps=stored().snaps.filter(s=>s.acc===acc.id&&s.date==='2026-03-31');
    same(snaps.map(s=>s.value),[1500],'the same day is replaced, not duplicated');
    need(/1\.500,00/.test($('accList').textContent),'the list does not show the new balance: '+$('accList').textContent);});
  await step('balances: no date is refused with a message and stores nothing',async()=>{
    const n=stored().snaps.length;$('snapDate').value='';$('snapSave').click();await tick();
    need(/Escolha a data dos saldos/.test(document.body.textContent),'no message');same(stored().snaps.length,n,'nothing stored');});

  // ---- 3. A series of monthly records, "apply to the next ones", delete one ----------------------------------------------------------------------------------
  const series=()=>stored().tx.filter(t=>t.desc==='Mensalidade').sort((a,b)=>a.date.localeCompare(b.date));
  const openFromList=async(id)=>{tab('lanc');$('qBox').value='Mensalidade';$('qBox').dispatchEvent(new Event('input'));await tick();
    const row=q(`#txList [data-tx="${id}"]`);need(row,'record '+id+' not in the list');row.click();await tick();need(q('#shFoot [data-act=edit]'),'no detail');};
  await step('series: "Todo mês · 3x" creates three records, one per month, with their own ids and one series number',async()=>{
    await addRecord({cents:'4000',cat:'Academia',date:'2026-05-10',desc:'Mensalidade',rep:3,fonte:'caixa'});
    const s3=series();same(s3.map(t=>[t.date,t.value]),[['2026-05-10',40],['2026-06-10',40],['2026-07-10',40]],'dates and values');
    need(new Set(s3.map(t=>t.id)).size===3,'ids not unique');need(new Set(s3.map(t=>t.serie)).size===1&&s3[0].serie!==undefined,'one series number: '+JSON.stringify(s3.map(t=>t.serie)));});
  await step('series: after saving a series the form goes back to "Não repetir" (the next record is one record, not three)',async()=>{
    $('fab').click();await tick();need($('fRep').value==='1','Repetir still says '+$('fRep').selectedOptions[0].textContent);
    const n=stored().tx.length;await addRecord({cents:'1234',date:'2026-02-01',desc:'avulso',fonte:'caixa'});
    same(stored().tx.length,n+1,'one record created, not a repeat of the last series');});
  await step('series: editing the middle one with "apply to the next" changes it and the later ones, not the earlier',async()=>{
    const [may,jun]=series();await openFromList(jun.id);q('#shFoot [data-act=edit]').click();await tick();
    need(!$('wApply').hidden&&$('applyN').textContent==='1','the option for 1 later record is not shown: '+$('applyN').textContent);
    type($('fVal'),'5500');$('fSave').click();await tick();closeSheet();
    same(series().map(t=>t.value),[40,55,55],'May kept, June and July changed');need(series()[0].id===may.id,'the first record is the same one');});
  await step('series: editing with the option off changes only that record',async()=>{
    const [may]=series();await openFromList(may.id);q('#shFoot [data-act=edit]').click();await tick();
    need(!$('wApply').hidden&&$('applyN').textContent==='2','two later records expected: '+$('applyN').textContent);
    $('fApply').checked=false;type($('fVal'),'6000');$('fSave').click();await tick();closeSheet();
    same(series().map(t=>t.value),[60,55,55],'only May changed');});
  await step('series: deleting one record leaves the others (with Desfazer)',async()=>{
    const [,jun]=series();await openFromList(jun.id);q('#shFoot [data-act=del]').click();await tick();if($('confirmDlg').open)$('cfOk').click();await tick();closeSheet();
    same(series().map(t=>t.date),['2026-05-10','2026-07-10'],'only June removed');
    const undo=q('#toast .toast-act');need(undo,'no undo');undo.click();await tick();same(series().map(t=>t.date),['2026-05-10','2026-06-10','2026-07-10'],'June back');});

  // ---- 4. Split inside the new-record form -------------------------------------------------------------------------------------------------------------------
  await step('split in the form: 100 with a part of 30 in another category is stored as parts that add up',async()=>{
    $('fab').click();await tick();type($('fVal'),'10000');$('fCat').value='Mercado';$('fDate').value='2026-04-02';$('fDesc').value='Compra dividida';
    $('wMore').open=true;$('splitBtn').click();need(!$('splitBox').hidden,'split box not shown');
    const c=q('[data-sc="0"]'),v=q('[data-sv="0"]');c.value='Saúde';c.dispatchEvent(new Event('input'));v.value='30,00';v.dispatchEvent(new Event('input'));
    need(/Resto em/.test($('splitSum').textContent)&&/70,00/.test($('splitSum').textContent),'rest not shown: '+$('splitSum').textContent);
    $('fSave').click();await tick();closeSheet();
    const t=stored().tx.find(x=>x.desc==='Compra dividida');need(t,'not stored');same([t.value,t.cat],[100,'Mercado'],'whole value kept on the record');
    same((t.splits||[]).map(x=>[x.cat,x.value]),[['Saúde',30]],'one part of 30 in Saúde');});
  await step('split in the form: parts above the total are refused and nothing is stored',async()=>{
    const n=stored().tx.length;$('fab').click();await tick();type($('fVal'),'1000');$('fCat').value='Mercado';$('fDate').value='2026-04-03';$('fDesc').value='Parte maior';
    $('wMore').open=true;$('splitBtn').click();const c=q('[data-sc="0"]'),v=q('[data-sv="0"]');c.value='Saúde';c.dispatchEvent(new Event('input'));v.value='50,00';v.dispatchEvent(new Event('input'));
    $('fSave').click();await tick();
    need($('sheet').open&&q('#txForm .ferr')&&/divis|parte|soma|total/i.test(q('#txForm .ferr').textContent),'no message about the parts: '+(q('#txForm .ferr')&&q('#txForm .ferr').textContent));same(stored().tx.length,n,'nothing stored');closeSheet();});

  // ---- 5. Paying a card invoice, in each of its ways ---------------------------------------------------------------------------------------------------------
  const payments=()=>stored().tx.filter(t=>t.type==='fatura');
  const expensesSum=()=>round(stored().tx.filter(t=>t.type==='despesa').reduce((a,t)=>a+t.value,0));
  const openPay=async()=>{$('fab').click();await tick();const r=q('input[name=tp][value=fatura]');r.checked=true;r.dispatchEvent(new Event('change'));await tick();need($('payBox').innerHTML.includes('Qual fatura'),'no invoice list');};
  const invoiceHead=fm=>q(`#payBox [data-pa="${fm}"]`);
  const openInvoice=fm=>{const h=invoiceHead(fm);need(h,'invoice '+fm+' not listed: '+qa('#payBox [data-pa]').map(e=>e.dataset.pa));if(!h.closest('.pay-inv').classList.contains('on'))h.click();};
  await step('pay invoice: setup, two purchases in the March invoice (100 and 50)',async()=>{
    await addRecord({cents:'5000',fonte:'cartao',date:'2026-03-22',desc:'compra B'});
    const cards=stored().tx.filter(t=>t.fonte==='cartao');same(cards.map(t=>t.value).sort((a,b)=>a-b),[50,100],'two card purchases');});
  await step('pay invoice: a partial amount of 0 is refused; an amount above what is open asks for a confirmation that shows what is open, what is paid, the difference and that it becomes an expense (Q8)',async()=>{
    await openPay();openInvoice('2026-03');q('input[name=payM][value=part]').click();
    type($('payVal'),'0');$('payGo').click();await tick();need($('payVal').getAttribute('aria-invalid')==='true'&&q('#payBox .ferr'),'0 accepted');
    same(payments().length,0,'nothing registered by the refused 0');
    // above the open amount (owner decision Q8, provisional): the confirmation says what is open, what will be paid, the difference, and that it becomes an expense, not a credit
    type($('payVal'),'50000');$('payGo').click();await tick();need($('confirmDlg').open,'no confirmation');
    const text=$('cfText').textContent;
    need(/Em aberto: R\$\s*150,00/.test(text)&&/Você vai pagar: R\$\s*500,00/.test(text)&&/Diferença: R\$\s*350,00/.test(text),'the amounts are not all shown: '+text);
    need(/Cartão \(sem detalhe\)/.test(text)&&/não vira crédito/.test(text),'the confirmation does not say how the difference is registered: '+text);
    $('cfCancel').click();await tick();same(payments().length,0,'cancelling registers nothing');
    type($('payVal'),'15000');$('payGo').click();await tick();need($('confirmDlg').open&&!/maior que o em aberto/.test($('cfText').textContent),'a payment of exactly what is open shows the warning');
    $('cfCancel').click();await tick();closeSheet();});
  await step('pay invoice: partial payment of 30 is registered once, the rest is 120, and paying does not count as an expense again',async()=>{
    const before=expensesSum();await openPay();openInvoice('2026-03');q('input[name=payM][value=part]').click();type($('payVal'),'3000');$('payGo').click();await confirmYes();
    same(payments().map(t=>t.value),[30],'one payment of 30');same(expensesSum(),before,'expenses unchanged by the payment');
    need(/120,00/.test(invoiceHead('2026-03').closest('.pay-inv').textContent),'the rest is not shown as 120,00: '+invoiceHead('2026-03').closest('.pay-inv').textContent.slice(0,200));closeSheet();});
  await step('pay invoice: unchecking a purchase pays only the checked ones (50 of 150 open)',async()=>{
    const a=stored().tx.find(t=>t.desc==='compra A');await openPay();openInvoice('2026-03');
    const box=q(`#payBox [data-pi="${a.id}"]`);need(box,'no checkbox for purchase A');box.click();
    need(/Só as compras marcadas/.test($('payBox').textContent),'the label does not say only the checked ones');
    q('#payGo').click();await confirmYes();
    const last=payments().at(-1);same(last.value,50,'the payment is the checked purchase (B = 50)');closeSheet();});
  await step('pay invoice: "Adicionar compra esquecida" adds a purchase to that invoice and the open amount grows',async()=>{
    await openPay();openInvoice('2026-03');const n=stored().tx.length;$('payNew').click();await tick();need($('itemDlg').open,'dialog not open');
    $('dCat').value='Mercado';$('dDesc').value='esquecida';type($('dVal'),'2500');$('dDate').value='2026-03-23';$('dSave').click();await tick();
    same(stored().tx.length,n+1,'one purchase added');const t=stored().tx.at(-1);same([t.fonte,t.value,t.date],['cartao',25,'2026-03-23'],'it is a card purchase');closeSheet();});
  await step('pay invoice: a future invoice sits under "Faturas futuras" and is paid in full',async()=>{
    const d=new Date();d.setDate(15);d.setMonth(d.getMonth()+3);const day=d.toLocaleDateString('sv');
    await addRecord({cents:'7000',fonte:'cartao',date:day,desc:'compra futura'});
    await openPay();need($('payFut'),'no future invoices group');$('payFut').open=true;
    const h=qa('#payFut [data-pa]');need(h.length>=1,'no future invoice');h[0].click();await tick();
    q('#payGo').click();await confirmYes();same(payments().at(-1).value,70,'paid the whole future invoice');closeSheet();});
  await step('pay invoice: the card purchases and the payments are consistent (paid never above bought)',()=>{
    const total=round(stored().tx.filter(t=>t.fonte==='cartao'&&t.type==='despesa').reduce((a,t)=>a+t.value,0)),paid=round(payments().reduce((a,t)=>a+t.value,0));
    need(paid<=total,'paid '+paid+' above bought '+total);need(paid===round(30+50+70),'paid '+paid);});

  // ---- 6. The advanced invoice form: pick the purchases, use their sum, save -------------------------------------------------------------------------------
  await step('invoice form: marked purchases add up, "usar a soma" fills the value, a payment above what the marked ones cover keeps the rest as "sem detalhe"',async()=>{
    await addRecord({cents:'8000',fonte:'cartao',date:'2026-01-10',desc:'compra janeiro 1'});
    await addRecord({cents:'2000',fonte:'cartao',date:'2026-01-12',desc:'compra janeiro 2'});
    $('fab').click();await tick();const r=q('input[name=tp][value=fatura]');r.checked=true;r.dispatchEvent(new Event('change'));await tick();
    $('payAdv').click();await tick();need(!$('fatBox').hidden,'the invoice form is not shown');
    // January purchases close on 24 January (best day 25): invoice due 28 January
    $('fFm').value='2026-01';$('fFm').dispatchEvent(new Event('change',{bubbles:true}));await tick();
    const boxes=qa('#fatList [data-fi]');same(boxes.length,2,'two January purchases listed; range: '+$('fmRange').textContent+' list: '+$('fatList').textContent.slice(0,200)+' fm='+$('fFm').value);
    need(boxes.every(b=>b.checked),'purchases of that invoice start marked');
    need(/Marcadas: .*100,00/.test($('fatSum').textContent),'sum of the marked ones is 100,00: '+$('fatSum').textContent);
    boxes[1].click();need(/Marcadas: .*80,00|Marcadas: .*20,00/.test($('fatSum').textContent),'sum after unmarking: '+$('fatSum').textContent);
    boxes[1].click();$('fatUse').click();need($('fVal').value==='R$ 100,00','"usar a soma" gave '+$('fVal').value);
    type($('fVal'),'12000');need(/Sem detalhe: .*20,00/.test($('fatSum').textContent),'a payment of 120 over 100 marked leaves 20,00 without detail: '+$('fatSum').textContent);
    const n=payments().length;$('fSave').click();await tick();if($('confirmDlg').open)$('cfOk').click();await tick();closeSheet();
    same(payments().length,n+1,'one payment registered');const p=payments().at(-1);same([p.value,p.fm],[120,'2026-01'],'the payment: 120 for the January invoice');});
  await step('invoice form: marked purchases above the payment are refused and nothing is registered',async()=>{
    await addRecord({cents:'9000',fonte:'cartao',date:'2026-02-10',desc:'compra fevereiro'});
    $('fab').click();await tick();const r=q('input[name=tp][value=fatura]');r.checked=true;r.dispatchEvent(new Event('change'));await tick();
    $('payAdv').click();await tick();$('fFm').value='2026-02';$('fFm').dispatchEvent(new Event('change',{bubbles:true}));await tick();
    type($('fVal'),'5000');need(/passam da fatura/.test($('fatSum').textContent),'no warning: '+$('fatSum').textContent);
    const n=payments().length;$('fSave').click();await tick();need(!$('confirmDlg').open||($('cfCancel').click(),true),'x');
    same(payments().length,n,'nothing registered while the marked purchases pass the payment');closeSheet();});

  // ---- 7. Import: the person chooses the columns -------------------------------------------------------------------------------------------------------------
  await step('import columns: with two date columns the first is used, "Ajustar colunas" lets the person pick the other, and what is saved follows the choice',async()=>{
    tab('lanc');$('impOpen').click();await tick();
    await sendFile('duas-datas.csv','Foo;Bar;Baz;Qux\n05/03/2026;06/03/2026;PADARIA DUAS DATAS;-12,50\n05/03/2026;07/03/2026;MERCADO DUAS DATAS;-30,00');
    await waitFor(()=>q('#impList .imp-row'),'review');
    need(qa('#impList .imp-row').every(r=>/05\/03/.test(r.textContent)),'first date column expected: '+qa('#impList .imp-row').map(r=>r.textContent.slice(0,40)));
    q('#impList [data-imp-cols], #sheet [data-imp-cols]').click();await tick();need($('map_date'),'mapping screen not shown');
    $('map_date').value='1';$('impMapGo').click();await waitFor(()=>q('#impList .imp-row'),'review again');
    need(qa('#impList .imp-row').map(r=>r.textContent).join('|').match(/06\/03.*|07\/03.*/),'second date column expected');
    const n=stored().tx.length;$('impGo').click();await tick();if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>q('.imp-ok'),'result');
    const added=stored().tx.slice(n).map(t=>[t.date,t.value,t.type]).sort();same(added,[['2026-03-06',12.5,'despesa'],['2026-03-07',30,'despesa']],'saved with the chosen date column');closeSheet();});
  await step('import columns: a file whose columns are not recognised opens the mapping screen; with no date column chosen it says so and saves nothing',async()=>{
    const n=stored().tx.length;tab('lanc');$('impOpen').click();await tick();
    await sendFile('sem-colunas.csv','Foo;Bar\nabc;def\nghi;jkl');await waitFor(()=>$('map_date'),'mapping screen');
    need(/Não identifiquei as colunas/.test($('sheet').textContent),'no explanation of why');
    $('impMapGo').click();await tick();need(/Escolha ao menos a coluna da data e a do valor/.test($('sheet').textContent),'no message');
    same(stored().tx.length,n,'nothing saved');closeSheet();});

  await step('no script error so far',()=>{need(errs.length===0,errs.join(' / '));});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

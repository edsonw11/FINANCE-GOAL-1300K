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
  const openFromList=async(id,query)=>{tab('lanc');$('qBox').value=query||'Mensalidade';$('qBox').dispatchEvent(new Event('input'));await tick();
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

  // ---- 7. Owner-reported bugs: split + repeat, the "Repetir" button, reinvestment, what a group is made of -----------------------------------------------------
  const splitRowsShown=()=>qa('#splitRows [data-sc]').map((c,i)=>[c.value,qa('#splitRows [data-sv]')[i].value]);
  await step('split + repeat: a record with split parts and "Todo mês · 3x" creates three records that all carry the parts',async()=>{
    $('fab').click();await tick();type($('fVal'),'10000');$('fCat').value='Mercado';$('fDate').value='2025-05-03';$('fDesc').value='Convenio e aluguel';
    $('wMore').open=true;$('splitBtn').click();const c=q('[data-sc="0"]'),v=q('[data-sv="0"]');c.value='Saúde';c.dispatchEvent(new Event('input'));v.value='30,00';v.dispatchEvent(new Event('input'));
    $('fRep').value='3';$('fSave').click();await tick();closeSheet();
    const rows=stored().tx.filter(t=>t.desc==='Convenio e aluguel');
    same(rows.map(t=>t.date),['2025-05-03','2025-06-03','2025-07-03'],'three months');
    same(rows.map(t=>(t.splits||[]).map(x=>[x.cat,x.value])),[[['Saúde',30]],[['Saúde',30]],[['Saúde',30]]],'every month has the split part');});
  await step('"Repetir" button: the copy opens with the split parts, saves them, and a cancelled copy leaves nothing in the next new record',async()=>{
    const src=stored().tx.find(t=>t.desc==='Convenio e aluguel');await openFromList(src.id,'Convenio e aluguel');q('#shFoot [data-act=dup]').click();await tick();
    need(!$('splitBox').hidden,'split box not open in the copy');same(splitRowsShown(),[['Saúde','R$ 30,00']],'the parts are in the copy');
    $('fDate').value='2025-09-09';$('fSave').click();await tick();closeSheet();
    const copy=stored().tx.filter(t=>t.desc==='Convenio e aluguel'&&t.date==='2025-09-09');
    same(copy.map(t=>(t.splits||[]).map(x=>[x.cat,x.value])),[[['Saúde',30]]],'the saved copy has the split part');need(!copy[0].serie,'the copy is not part of the old series');
    // a copy that is cancelled must not leave its parts in the next new record
    await openFromList(src.id,'Convenio e aluguel');q('#shFoot [data-act=dup]').click();await tick();need(!$('splitBox').hidden,'copy opened without parts');closeSheet();
    $('fab').click();await tick();need($('splitBox').hidden,'the next new record starts with the parts of the cancelled copy');$('splitBtn').click();same(splitRowsShown(),[['','']],'opening the split starts with one empty part, not the cancelled copy');closeSheet();});
  await step('reinvestment: an aporte marked "É reinvestimento" is not "Investido", does not leave the month, and is shown apart',async()=>{
    tab('meta');$('newAcc').value='CDB teste';$('addAcc').click();await tick();
    const acc=stored().accounts.find(a=>a.name==='CDB teste');need(acc,'account not created');
    await addRecord({type:'receita',cents:'300000',cat:'Salário',date:'2025-08-05',desc:'salário',fonte:'caixa'});
    // a normal aporte of 1000 and a reinvestment of 500, both through the form
    $('fab').click();await tick();let r=q('input[name=tp][value=aporte]');r.checked=true;r.dispatchEvent(new Event('change'));
    need(!$('wReinv').hidden,'the reinvestment option is not shown for an aporte');need($('fReinv').checked===false,'it starts unchecked');
    type($('fVal'),'100000');$('fAcc').value=acc.id;$('fDate').value='2025-08-10';$('fSave').click();await tick();closeSheet();
    $('fab').click();await tick();r=q('input[name=tp][value=aporte]');r.checked=true;r.dispatchEvent(new Event('change'));
    type($('fVal'),'50000');$('fAcc').value=acc.id;$('fDate').value='2025-08-12';$('fDesc').value='CDB venceu';$('fReinv').checked=true;$('fSave').click();await tick();closeSheet();
    const ap=stored().tx.filter(t=>t.type==='aporte'&&t.date.startsWith('2025-08'));
    same(ap.map(t=>[t.value,t.reinv===true]),[[1000,false],[500,true]],'the mark is stored only on the reinvestment');
    $('fab').click();await tick();need($('fReinv').checked===false,'the mark stays on for the next record');closeSheet();
    tab('resumo');
    const kf=$('kFlow').textContent;need(/Investido/.test(kf)&&/1\.000,00/.test(kf)&&!/1\.500,00/.test(kf),'the Investido card should show 1.000,00 and not 1.500,00: '+kf);
    need(/Investiu R\$\s?1\.000,00/.test(document.body.textContent),'the hero should say Investiu R$ 1.000,00');
    need(/Ficou na conta R\$\s?2\.000,00/.test(document.body.textContent),'the leftover in the account must be 3000 - 1000 = 2.000,00 (the reinvestment does not leave it)');});
  await step('reinvestment: the detail of "Investido" lists the reinvestment apart, and editing the mark back makes it a normal aporte',async()=>{
    q('[data-kpi="contrib"]').click();await tick();
    need(/Reinvestimentos/.test($('sheet').textContent),'no "Reinvestimentos" group: '+$('sheet').textContent.slice(0,200));closeSheet();
    const re=stored().tx.find(t=>t.reinv);await openFromList(re.id,'CDB venceu');q('#shFoot [data-act=edit]').click();await tick();
    need($('fReinv').checked,'the edit form does not show the mark');$('fReinv').checked=false;$('fSave').click();await tick();closeSheet();
    same(stored().tx.filter(t=>t.type==='aporte'&&t.date.startsWith('2025-08')).map(t=>t.reinv===undefined),[true,true],'the mark is removed from the stored record');
    need(/1\.500,00/.test($('kFlow').textContent),'after the edit it counts as new money again: '+$('kFlow').textContent);});
  await step('spending by group: a phone bill under "Moradia" shows "Telefone" under the group name',async()=>{
    await addRecord({cents:'3000',cat:'Telefone',date:'2025-10-14',desc:'Plano',fonte:'caixa'});tab('resumo');
    const row=q('#cats .catrow');need(row&&/Moradia/.test(row.textContent),'the group row is not Moradia: '+(row&&row.textContent));
    const sub=row.querySelector('[data-smoke=group-parts]');need(sub&&sub.textContent==='Telefone','the group does not say what it is made of: '+(sub&&sub.textContent));
    await addRecord({cents:'8000',cat:'Luz',date:'2025-10-15',desc:'Conta de luz',fonte:'caixa'});
    need(q('#cats .catrow [data-smoke=group-parts]').textContent==='Luz, Telefone','several categories are listed by value: '+q('#cats .catrow [data-smoke=group-parts]').textContent);});

  await step('import: the name typed for a new investment account is kept even if the field is never left (no change event)',async()=>{
    const acc0=stored().accounts.length,tx0=stored().tx.length;tab('lanc');$('impOpen').click();
    await sendFile('aporte-novo.csv','Data;Descrição;Valor\n06/11/2025;PIX ENVIADO CORRETORA NOVA;-3.000,00');await waitFor(()=>q('#impList .imp-row'),'review');
    q('#impList .imp-main').click();
    const ty=q('#impList [data-f=type]');ty.value='aporte';ty.dispatchEvent(new Event('change',{bubbles:true}));
    const sel=q('#impList [data-f=acc]');sel.value='__new';sel.dispatchEvent(new Event('change',{bubbles:true}));
    type(q('#impList [data-f=newAcc]'),'Banco Digitado'); // only input events, like a phone keyboard that is not closed before the tap
    $('impGo').click();await tick();if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>q('.imp-done'),'result');
    const st=stored(),a=st.accounts.find(x=>x.name==='Banco Digitado');
    need(st.accounts.length===acc0+1&&a,'the typed account was not created: '+JSON.stringify(st.accounts.map(x=>x.name)));
    need(st.tx.length===tx0+1&&st.tx.some(t=>t.type==='aporte'&&t.value===3000&&t.acc===a.id),'aporte not saved in the typed account');
    $('impDone').click();tab('lanc');$('impOpen').click();
    await sendFile('aporte-novo2.csv','Data;Descrição;Valor\n07/11/2025;PIX ENVIADO CORRETORA NOVA;-1.000,00');await waitFor(()=>q('#impList .imp-row'),'second review');
    q('#impList .imp-main').click();const ty2=q('#impList [data-f=type]');ty2.value='aporte';ty2.dispatchEvent(new Event('change',{bubbles:true}));
    const sel2=q('#impList [data-f=acc]');need([...sel2.options].some(o=>o.textContent==='Banco Digitado'),'the created account is not offered in the next import');
    $('impClose')&&$('impClose').click();closeSheet();});

  await step('category chips under the field fill the category (new record)',async()=>{
    $('fab').click();await tick();const r=q('input[name=tp][value=despesa]');r.checked=true;r.dispatchEvent(new Event('change'));await tick();
    const chips=qa('#catChips .chip');need(chips.length>0,'no category chips');const pick=chips[chips.length-1];const name=pick.dataset.qc;
    pick.click();await tick();need($('fCat').value===name,'the chip did not fill the category: "'+$('fCat').value+'" expected "'+name+'"');
    need(q('#catChips .chip.on')&&q('#catChips .chip.on').dataset.qc===name,'the chosen chip is not marked');closeSheet();});

  await step('split parts: editing a saved record shows one-tap categories on each part; tapping one changes the part',async()=>{
    $('fab').click();await tick();type($('fVal'),'20000');$('fCat').value='Mercado';$('fDate').value='2025-11-03';$('fDesc').value='Compra com parte';
    $('wMore').open=true;$('splitBtn').click();const c0=q('[data-sc="0"]'),v0=q('[data-sv="0"]');c0.value='Saúde';c0.dispatchEvent(new Event('input'));v0.value='50,00';v0.dispatchEvent(new Event('input'));
    $('fSave').click();await tick();closeSheet();
    const id=stored().tx.find(x=>x.desc==='Compra com parte').id;await openFromList(id,'Compra com parte');q('#shFoot [data-act=edit]').click();await tick();
    need(!$('splitBox').hidden&&q('[data-sc="0"]').value==='Saúde','the edit form does not show the saved part');
    need(q('#splitRows .sp-part:first-child [data-qchips] .chip'),'the part has no one-tap categories');
    need(q('[data-sc="0"]').getBoundingClientRect().width>=$('fDesc').getBoundingClientRect().width*0.9,'the part category field is narrower than a normal field: '+q('[data-sc="0"]').getBoundingClientRect().width);
    const chip=qa('#splitRows .sp-part:first-child [data-qchips] .chip').find(b=>b.dataset.qc!=='Saúde');need(chip,'no other category to pick');
    chip.click();await tick();need(q('[data-sc="0"]').value===chip.dataset.qc,'the chip did not change the part: '+q('[data-sc="0"]').value);
    need(q('#splitRows .sp-part:first-child [data-qchips] .chip.on')&&q('#splitRows .sp-part:first-child [data-qchips] .chip.on').dataset.qc===chip.dataset.qc,'the chosen chip is not marked');
    const inView=c=>{const a=c.getBoundingClientRect(),b=c.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;};
    need(inView(q('#splitRows .sp-part:first-child [data-qchips] .chip.on')),'the chosen chip is hidden off the side of the row');
    need(q('#splitRows .sp-part:first-child [data-qchips]').getBoundingClientRect().height<50,'the one-tap categories take more than one line: '+q('#splitRows .sp-part:first-child [data-qchips]').getBoundingClientRect().height);
    const gap=q('#splitRows .sp-part:first-child [data-sv]').getBoundingClientRect().top-q('#splitRows .sp-part:first-child [data-qchips]').getBoundingClientRect().bottom;need(gap>=8,'the value field is stuck to the categories: '+gap);
    $('fSave').click();await tick();if($('confirmDlg').open)$('cfOk').click();await tick();closeSheet();
    const t=stored().tx.find(x=>x.desc==='Compra com parte');same((t.splits||[]).map(x=>[x.cat,x.value]),[[chip.dataset.qc,50]],'the stored part has the tapped category');});

  await step('category group is a select: pick an existing group, or create a new one from "Novo grupo…"',async()=>{
    tab('cad');await tick();qa('#catPage details.cat-det').forEach(d=>d.open=true);await tick();
    const sel=q('#catPage select[data-cg]');need(sel,'the group of a category is not a select');
    need([...sel.options].some(o=>/Novo grupo/.test(o.textContent))&&[...sel.options].some(o=>o.value===''),'options: '+[...sel.options].map(o=>o.textContent).join('|'));
    const i=sel.dataset.cg,name=sel.getAttribute('aria-label').replace('Grupo de ','');
    sel.value='__new_group';sel.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    const inp=q(`#catPage input[data-cg="${i}"]`);need(inp&&!q(`#catPage select[data-cg="${i}"]`),'"Novo grupo…" did not give a text field');
    inp.value='Grupo Teste Novo';inp.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    const cat=stored().cats.despesa.find(c=>c.name===name);need(cat&&cat.group==='Grupo Teste Novo','the new group was not set on the category: '+JSON.stringify(cat));
    need((stored().groups||[]).some(g=>g.name==='Grupo Teste Novo'),'the group was not created');
    qa('#catPage details.cat-det').forEach(d=>d.open=true);await tick();
    const sel2=qa('#catPage select[data-cg]').find(s=>s.getAttribute('aria-label')==='Grupo de '+name);need(sel2&&sel2.value==='Grupo Teste Novo','the select does not show the new group: '+(sel2&&sel2.value));
    sel2.value='';sel2.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    need(!stored().cats.despesa.find(c=>c.name===name).group,'"Sem grupo" did not clear the group');tab('resumo');});

  await step('language: flag buttons switch between Portuguese, English and Spanish, the whole screen follows, "Automático" follows the phone, the choice is saved',async()=>{
    tab('cfg');await tick();
    const btn=v=>q('#langBtns [data-lang="'+v+'"]'),pick=async v=>{btn(v).click();await tick();},nav=()=>q('#nav [data-t=resumo] [data-i18n]').textContent;
    need([...qa('#langBtns [data-lang]')].map(b=>b.dataset.lang).join()==='auto,pt-BR,en-US,es','buttons: '+[...qa('#langBtns [data-lang]')].map(b=>b.dataset.lang).join());
    need(!$('langSel'),'the old language combo is still on the page');
    need(qa('#langBtns .lang-btn').every(b=>b.querySelector('.lang-flag svg')),'every button needs a flag or icon');
    same(qa('#langBtns [data-lang]').slice(1).map(b=>b.querySelector('.lang-name').textContent),['Português','English','Español'],'each language is written in itself');
    const NAV={'pt-BR':'Resumo','en-US':'Summary','es':'Resumen'},H1={'pt-BR':'Resumo do mês','en-US':'Monthly summary'},CFG={'pt-BR':'Ajustes','en-US':'Settings','es':'Ajustes'};
    const L=['pt-BR','en-US','es'];
    for(const a of L)for(const b of L){await pick(a);await pick(b);
      need(document.documentElement.lang===b,a+' -> '+b+': <html lang> is '+document.documentElement.lang);
      need(nav()===NAV[b],a+' -> '+b+': menu says '+nav());
      need(q('#bnav [data-t=resumo] [data-i18n]').textContent===NAV[b],a+' -> '+b+': the phone menu says '+q('#bnav [data-t=resumo] [data-i18n]').textContent);
      need(q('#nav [data-t=cfg] [data-i18n]').textContent===CFG[b],a+' -> '+b+': settings tab says '+q('#nav [data-t=cfg] [data-i18n]').textContent);
      if(H1[b])need(q('#t-resumo h1').textContent===H1[b],a+' -> '+b+': page title is '+q('#t-resumo h1').textContent);
      need(btn(b).getAttribute('aria-checked')==='true'&&qa('#langBtns [aria-checked=true]').length===1,a+' -> '+b+': the pressed flag is not '+b);
      need(qa('#nav [data-t] svg').length>=7,a+' -> '+b+': the menu icons were lost');
      need(localStorage.getItem('metaapp.language')===b,'the choice was not saved: '+localStorage.getItem('metaapp.language'));}
    await pick('en-US');need(/In use now: English/.test($('langInfo').textContent)&&/3 languages available/.test($('langInfo').textContent),'info: '+$('langInfo').textContent);
    need(!/Resumo|Lançamentos|Ajustes/.test(q('#nav').textContent),'the menu still has Portuguese words in English: '+q('#nav').textContent);
    await pick('es');need(/En uso ahora: Español/.test($('langInfo').textContent)&&/3 idiomas disponibles/.test($('langInfo').textContent),'info: '+$('langInfo').textContent);
    need(/Automático/.test(btn('auto').querySelector('.lang-name').textContent),'auto label: '+btn('auto').textContent);
    // the date in the header is written in the chosen language
    await pick('en-US');need(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/.test($('todayLbl').textContent),'date in English: '+$('todayLbl').textContent);
    await pick('es');need(/^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/.test($('todayLbl').textContent),'date in Spanish: '+$('todayLbl').textContent);
    await pick('pt-BR');need(/-feira|sábado|domingo/.test($('todayLbl').textContent),'date in Portuguese: '+$('todayLbl').textContent);
    // automatic: follows the language of the phone (here faked), and falls back to English for one the app does not have
    const fake=l=>Object.defineProperty(navigator,'languages',{configurable:true,get:()=>l});
    fake(['es-MX']);await pick('auto');need(document.documentElement.lang==='es'&&localStorage.getItem('metaapp.language')==='auto','auto on a Spanish phone: '+document.documentElement.lang);
    need(btn('auto').getAttribute('aria-checked')==='true','the automatic button is not marked');
    need(/Idioma detectado en el dispositivo: Español/.test($('langInfo').textContent),'info: '+$('langInfo').textContent);
    fake(['pt-PT']);await pick('en-US');await pick('auto');need(document.documentElement.lang==='pt-BR','auto on a Portuguese phone: '+document.documentElement.lang);
    fake(['fr-FR','de']);await pick('es');await pick('auto');need(document.documentElement.lang==='en-US','auto on a French phone should fall back to English: '+document.documentElement.lang);
    need(nav()==='Summary','the menu is not in English after the fallback: '+nav());
    fake(['fr-FR','es-AR']);await pick('en-US');await pick('auto');need(document.documentElement.lang==='es','auto takes the first supported language of the phone: '+document.documentElement.lang);
    // back to Portuguese so the rest of the checks (written in Portuguese) keep working
    await pick('pt-BR');need(nav()==='Resumo'&&document.documentElement.lang==='pt-BR','not back in Portuguese');
    delete navigator.languages;tab('resumo');});

  await step('no script error so far',()=>{need(errs.length===0,errs.join(' / '));});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

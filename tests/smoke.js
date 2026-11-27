/**
 * tests/smoke.js
 * Responsibility: end-to-end scenario using only the DOM, like a user would (taps, typing,
 * confirmations). Loaded as a module after app.js (so it runs once the app is ready) and writes the result to <html data-smoke="...">.
 * Covers the acceptance list: money mask, dates, clickable cards whose items add up to the
 * total, detail, edit without duplicating, delete with confirmation (and cancel), a save error
 * that keeps the form, period kept after closing, invoice payment and its cancellation.
 */
(async function(){
  const errs=[],out=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
  window.addEventListener('unhandledrejection',e=>errs.push('ERR rejection '+e.reason));
  const $=id=>document.getElementById(id),q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const tick=()=>new Promise(r=>setTimeout(r,0));
  const step=async(n,f)=>{try{await f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}document.documentElement.setAttribute('data-smoke',out.concat(errs,['…running']).join(' | '));};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  const money=t=>{const neg=/[−-]/.test(t);const v=+String(t).replace(/[^\d,]/g,'').replace(',','.');return neg?-v:v;};
  const type=(el,text)=>{el.focus();el.value='';for(const ch of text){const be=new InputEvent('beforeinput',{data:ch,inputType:'insertText',bubbles:true,cancelable:true});
    if(el.dispatchEvent(be)){el.value+=ch;el.dispatchEvent(new Event('input',{bubbles:true}));}}};
  const detailOpen=()=>!!q('#shFoot [data-act=del]');
  const confirmYes=async()=>{await tick();need($('confirmDlg').open,'confirmation not shown');$('cfOk').click();await tick();};
  const confirmNo=async()=>{await tick();need($('confirmDlg').open,'confirmation not shown');$('cfCancel').click();await tick();};
  const rows=()=>qa('#shBody .lst [data-tx]');
  const sheetTotal=()=>money(q('#shBody .bd-v').textContent);
  const rowsSum=()=>Math.round(rows().reduce((a,r)=>a+Math.abs(money(r.querySelector('.li-v').textContent)),0)*100)/100;
  // headless Chrome runs with virtual time: timers alone can fire before a Worker (pdf.js) answers, so every poll also waits for a real (failing) image load
  const realTick=()=>new Promise(r=>{const i=new Image();i.onload=i.onerror=()=>r();i.src='tick-'+Math.random()+'.png';});
  const waitFor=async(f,what,max)=>{for(let i=0;i<(max||600);i++){if(f())return;await Promise.all([realTick(),new Promise(r=>setTimeout(r,5))]);}throw new Error('timeout: '+what);};
  const stored=()=>JSON.parse(localStorage.getItem('metaapp.v2'));
  const chooseFile=async(name,text)=>{const dt=new DataTransfer();dt.items.add(new File([text],name,{type:'text/plain'}));const i=$('impFile');i.files=dt.files;i.dispatchEvent(new Event('change'));if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>$('impSend')&&$('impDrop').textContent.includes(name),'send button for '+name);need(/Enviar/.test($('impSend').textContent),'send label');$('impSend').click();};
  const openKpi=k=>{$('sheet').open&&$('shClose').click();q(`#kFlow [data-kpi=${k}]`).click();need($('sheet').open,'sheet closed');};

  await step('generate test data',()=>$('demoOn').click());
  await step('go to previous month (oct)',()=>{q('#t-resumo [data-mv="-1"]').click();need(/outubro/i.test($('mLab1').textContent),'month '+$('mLab1').textContent);});
  await step('summary has chart and analysis',()=>{need($('chTrend').innerHTML.length>500,'chTrend empty');need($('trendIns').innerHTML.length>500,'trendIns empty');});

  // money mask
  await step('money mask 123456 -> R$ 1.234,56',()=>{type($('fVal'),'123456');need($('fVal').value==='R$ 1.234,56','got '+$('fVal').value);});
  await step('money mask rejects letters',()=>{type($('fVal'),'12a3');need($('fVal').value==='R$ 1,23','got '+$('fVal').value);$('fVal').value='';});
  // dates
  await step('date shows dd/mm/aaaa and keeps ISO',()=>{$('fDate').value='2026-10-05';const txt=$('fDate').closest('.dp').querySelector('.dp-text');
    need($('fDate').value==='2026-10-05','iso '+$('fDate').value);need(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').get.call(txt)==='05/10/2026','text');
    need(q('#fDate + .dp-native')||$('fDate').parentElement.querySelector('.dp-native'),'no native picker');});

  // cards: items add up to the total
  await step('expenses card lists records with the same total',()=>{openKpi('expenses');const card=money(q('#kFlow [data-kpi=expenses] .v').textContent);
    need(rows().length>0,'no rows');need(Math.abs(sheetTotal())===Math.abs(card),'sheet '+sheetTotal()+' card '+card);need(Math.abs(rowsSum()-Math.abs(card))<0.005,'rows '+rowsSum()+' card '+card);});
  await step('summary: one "left" number with its split, no contradicting card, no 6-month flow chart, reserve hidden until marked',()=>{
    const h=$('monthHero');need(h&&/Sobrou em/.test(h.textContent),'no hero');need(/Investiu/.test(h.textContent)&&/(na|da) conta/.test(h.textContent),'no split: '+h.textContent.slice(0,200));
    need(!/Sobrou no caixa/.test($('t-resumo').textContent),'"Sobrou no caixa" still on the Summary');need(!$('chFlow'),'6-month flow chart still there');
    need(!q('#healthRow'),'old savings card');need($('reserveCard').hidden,'empty reserve card shown');
    const order=['monthHero','kFlow','cats','budgetCard','chTrend'].map(id=>$(id).getBoundingClientRect().top);need(order.every((y,i)=>i===0||y>order[i-1]),'order: '+order);
    need(!$('t-resumo').contains($('trendIns')),'analysis still inside the Summary');});
  await step('every summary card opens its records',()=>{for(const k of ['income','contrib','voucher']){if(k==='voucher'){need(!q('[data-kpi=voucher]'),'VR/VA card shown with no VR/VA at all');continue;}openKpi(k);need(q('#shBody .bd-total'),'no total for '+k);}$('shClose').click();});

  await step('analysis tiles and trend cards open their lists',()=>{need(!q('#t-analise [data-kpi=avg]'),'"Média mensal" repeated in Análise');for(const k of ['avg','fixed','variable','top3','lastmonth','trend']){
      const el=q(`#t-resumo [data-kpi=${k}]`)||q(`#t-analise [data-kpi=${k}]`);need(el,'no card '+k);el.click();need($('sheet').open&&q('#shBody .bd-total'),'nothing opened for '+k);$('shClose').click();}
    q('#t-resumo [data-kpi=avg]').click();const mrow=q('#shBody [data-go=month]');need(mrow,'no month row');mrow.click();need(/Despesas/.test($('shTitle').textContent),'month row did not open expenses');$('shClose').click();});
  await step('goal cards open their lists',()=>{q('#bnav [data-t=meta]').click();q('[data-kpi=networth]').click();need(rows().length===0&&qa('#shBody .li').length>0,'no accounts');$('shClose').click();q('[data-kpi=yield]').click();need($('sheet').open,'yield');$('shClose').click();q('#bnav [data-t=resumo]').click();});
  // detail, delete cancel, edit, delete
  let before=0;
  await step('tap a record opens the detail',()=>{openKpi('expenses');before=rows().length;rows()[0].click();
    need(q('#shFoot [data-act=edit]')&&q('#shFoot [data-act=del]'),'no actions');need(!$('shBack').hidden,'no back button');});
  await step('delete is immediate, Desfazer brings it back',async()=>{q('#shFoot [data-act=del]').click();await tick();
    need(!$('confirmDlg').open,'plain record still asks');need(/Lançamento excluído/.test($('toast').textContent),'toast: '+$('toast').textContent);
    const undoBtn=q('#toast .toast-act');need(undoBtn&&/Desfazer/.test(undoBtn.textContent),'no Desfazer');
    if(detailOpen())$('shBack').click();need(rows().length===before-1,'not removed: '+rows().length);
    undoBtn.click();need(rows().length===before,'not restored: '+rows().length+' vs '+before);});
  await step('edit saves without duplicating',()=>{rows()[0].click();q('#shFoot [data-act=edit]').click();need($('txForm').closest('#shBody'),'form not in sheet');
    need($('fVal').value.startsWith('R$'),'value not loaded');type($('fVal'),'77700');$('fSave').click();
    need(q('#shFoot [data-act=edit]'),'did not return to detail');need(/777,00/.test(q('#shBody .dt-v').textContent),'value not updated');
    $('shBack').click();need(rows().length===before,'duplicated: '+rows().length+' vs '+before);need(Math.abs(rowsSum()-Math.abs(sheetTotal()))<0.005,'total not refreshed');});
  await step('delete removes it everywhere',async()=>{const card0=money(q('#kFlow [data-kpi=expenses] .v').textContent);
    rows()[0].click();q('#shFoot [data-act=del]').click();await tick();if(detailOpen())$('shBack').click();
    need(rows().length===before-1,'not removed');need(Math.abs(Math.abs(money(q('#kFlow [data-kpi=expenses] .v').textContent))-(Math.abs(card0)-777))<0.005,'card total not updated');});
  await step('closing keeps period and filters',()=>{$('shClose').click();need(/outubro/i.test($('mLab1').textContent),'period lost');});

  // new record via "+": validation, save error keeps the form, then save
  await step('new record: required value shows inline message',()=>{$('fab').click();need($('txForm').closest('#shBody'),'form not in sheet');$('fVal').value='';$('fSave').click();need(q('#txForm .ferr'),'no inline error');});
  await step('save error keeps what was typed',()=>{const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('QuotaExceeded');};
    try{type($('fVal'),'4590');$('fDate').value='2026-10-05';$('fCat').value='Mercado';$('fSave').click();}finally{Storage.prototype.setItem=orig;}
    need($('fVal').value==='R$ 45,90','form cleared: '+$('fVal').value);need($('sheet').open,'sheet closed on error');});
  await step('save new expense on chosen date',()=>{$('fSave').click();need(!$('sheet').open,'sheet still open');
    q('#bnav [data-t=lanc]').click();const r=qa('#txList [data-tx]').find(x=>/45,90/.test(x.textContent));need(r,'not in list');
    const t=JSON.parse(localStorage.getItem('metaapp.v2')).tx.find(x=>x.value===45.9);need(t,'not persisted as number 45.9');need(t.date==='2026-10-05','date shifted: '+t.date);
    let d=r.previousElementSibling;while(d&&!d.classList.contains('li-day'))d=d.previousElementSibling;need(d&&/05/.test(d.textContent),'day header '+(d&&d.textContent));});
  await step('transaction list: filters and search',()=>{q('#chips [data-f=despesa]').click();need(qa('#txList [data-tx]').length>0,'empty filter');
    $('qBox').value='zzzz';$('qBox').dispatchEvent(new Event('input'));need($('clearFilt'),'no clear button');$('clearFilt').click();need(qa('#txList [data-tx]').length>0,'clear failed');});

  await step('list rows have no "Excluir"; search finds every month, accents ignored',()=>{
    need(!qa('#txList button').some(b=>/Excluir/.test(b.textContent)),'Excluir inside a row');
    q('#t-lanc [data-mv="1"]').click();q('#chips [data-f=todos]').click();
    $('qBox').value='MÉRCADO';$('qBox').dispatchEvent(new Event('input'));
    need(qa('#txList .li-month').length>=1,'no month headings');need(/em todos os meses/.test($('t-lanc').textContent),'no "todos os meses" note');
    need(qa('#txList [data-tx]').some(x=>/45,90/.test(x.textContent)),'October record not found from November');
    $('qBox').value='';$('qBox').dispatchEvent(new Event('input'));need(!qa('#txList .li-month').length,'month headings after clearing');q('#t-lanc [data-mv="-1"]').click();});
  // category detail
  await step('category detail with months and records',()=>{q('#bnav [data-t=resumo]').click();q('#cats [data-go=cat]').click();need(q('#shBody details.cm[open] [data-tx]'),'month not expanded');$('shClose').click();});
  // groups: Luz and Internet belong to Moradia; the group shows its categories and drills down
  await step('summary lists groups (Luz inside Moradia)',()=>{const names=qa('#cats [data-go=cat]').map(r=>r.dataset.c);
    need(names.includes('Moradia'),'no Moradia: '+names);need(!names.includes('Luz')&&!names.includes('Internet'),'Luz/Internet listed apart: '+names);});
  await step('group detail splits by category and drills down',()=>{q('#cats [data-go=cat][data-c="Moradia"]').click();
    const subs=qa('#shBody [data-subcat]').map(x=>x.dataset.subcat);need(subs.includes('Luz')&&subs.includes('Moradia'),'split: '+subs);
    const split=qa('#shBody [data-subcat]').reduce((a,x)=>a+money(x.querySelector('.li-v').textContent),0),total=money(q('#shBody .cts .ct-v').textContent);
    need(Math.abs(split-total)<=1,'split '+split+' vs total '+total);
    q('#shBody [data-subcat="Luz"]').click();need(/Luz/.test($('shTitle').textContent)&&/grupo Moradia/.test($('shSub').textContent),'drill: '+$('shTitle').textContent+' / '+$('shSub').textContent);
    $('shBack').click();need(/Moradia/.test($('shTitle').textContent),'back');$('shClose').click();});
  await step('analysis table is by group',()=>{need(qa('#trendIns [data-cm]').some(tr=>/Moradia/.test(tr.textContent)),'no Moradia row');
    need(!qa('#trendIns [data-cm]').some(tr=>/^\s*\S+\s+Luz\s*$/.test(tr.querySelector('td').textContent)),'Luz listed apart');});
  await step('categories tab: move a category to a new group',()=>{q('#nav [data-t=cad]').click();need(q('#catPage .cat-gh'),'no group headers');
    const el=qa('#catPage [data-cg]').find(x=>x.closest('div').previousElementSibling.querySelector('[data-cn]').value==='Internet');need(el&&el.value==='Moradia','Internet group '+(el&&el.value));
    el.value='__new_group';el.dispatchEvent(new Event('change'));const typed=q('#catPage input[data-cg="'+el.dataset.cg+'"]');need(typed,'no text field for the new group name');typed.value='Contas fixas';typed.dispatchEvent(new Event('change'));
    need(qa('#catPage .cat-gh b').some(b=>b.textContent==='Contas fixas'),'new group not shown');
    q('#nav [data-t=resumo]').click();need(qa('#cats [data-go=cat]').some(r=>r.dataset.c==='Contas fixas')||!qa('#cats [data-go=cat]').length,'summary not by new group');
    q('#nav [data-t=cad]').click();const back=qa('#catPage [data-cg]').find(x=>x.value==='Contas fixas');back.value='Moradia';back.dispatchEvent(new Event('change'));
    need(qa('#catPage [data-cg]').find(x=>x.closest('div').previousElementSibling.querySelector('[data-cn]').value==='Internet').value==='Moradia','not moved back');});

  // budget per group: set in Categorias, shown in Resumo, alert after saving
  await step('budget: empty state links to Categorias',()=>{q('#nav [data-t=resumo]').click();need(/Definir orçamentos/.test($('budgetCard').textContent),'no empty state');
    q('#budgetCard [data-go=tab]').click();need($('t-cad').classList.contains('on'),'did not open Categorias');});
  await step('budget: set Alimentação and see it in Resumo',()=>{const el=q('#catPage [data-gb="Alimentação"]');need(el,'no budget field');
    type(el,'50000');need(el.value==='R$ 500,00','mask '+el.value);el.dispatchEvent(new Event('change'));
    q('#nav [data-t=resumo]').click();const row=q('#budgetCard [data-c="Alimentação"]');need(row,'no budget row');
    need(/\/ R\$ 500/.test(row.textContent),'row '+row.textContent);need(q('#budgetCard .pbar'),'no bar');
    row.click();need(/Alimentação/.test($('shTitle').textContent),'did not open the group');$('shClose').click();});
  await step('budget: saving an expense over the limit warns',()=>{$('fab').click();type($('fVal'),'99999');$('fCat').value='Mercado';$('fDate').value=new Date().toLocaleDateString('sv');
    $('fSave').click();need(/⚠️ Alimentação: \d+% do orçamento/.test($('toast').textContent),'toast: '+$('toast').textContent);
    need(q('#budgetCard .pbar-over'),'not shown as over');});
  // monthly bills: Condomínio, Luz and Internet repeat every month in the test data
  await step('bills: recurring bills listed, missing one can be entered',()=>{const items=qa('#billsCard .bill-row');need(items.length>=3,'bills '+items.length);
    need(/de \d+ pagas/.test($('billsCard').textContent),'no summary');
    const miss=q('#billsCard [data-bill]');
    if(miss){const name=miss.closest('.bill-row').querySelector('.li-t').textContent;miss.click();need($('txForm').closest('#shBody'),'form not opened');
      need($('fVal').value.startsWith('R$'),'value not filled');need($('fCat').value,'category not filled');$('fSave').click();
      need(!qa('#billsCard [data-bill]').some(b=>b.closest('.bill-row').querySelector('.li-t').textContent===name),'still missing after saving');}
    const paid=q('#billsCard .bill-row[data-tx]');need(paid,'no paid bill');paid.click();need(q('#shFoot [data-act=edit]'),'paid bill does not open the record');$('shClose').click();});
  await step('bills: hide one that is not a bill, then restore',()=>{const n=qa('#billsCard .bill-row').length;q('#billsCard [data-bill-hide]').click();
    need(qa('#billsCard .bill-row').length===n-1,'not hidden');need(q('#billsCard [data-bill-restore]'),'no restore link');
    q('#billsCard [data-bill-restore]').click();need(qa('#billsCard .bill-row').length===n,'not restored');});
  // transactions filter by group
  await step('transactions: filter by group',()=>{q('#bnav [data-t=lanc]').click();q('#t-lanc [data-mv="-1"]').click();q('#chips [data-f=todos]').click();const sel=$('grpSel');
    need([...sel.options].some(o=>o.value==='Moradia'),'no Moradia option');sel.value='Moradia';sel.dispatchEvent(new Event('change'));
    const rows=qa('#txList [data-tx]');need(rows.length>0,'empty: month '+$('mLab2').textContent+' sel='+sel.value+' q='+$('qBox').value+' list='+$('txList').textContent.slice(0,200));need(/em Moradia/.test(q('#txList .li-sum').textContent),'summary');
    need(!rows.some(r=>/Mercado/.test(r.textContent)),'Mercado listed under Moradia');sel.value='';sel.dispatchEvent(new Event('change'));q('#t-lanc [data-mv="1"]').click();});
  // quick entry by sentence: fills the normal form, saves only when the user taps save
  await step('quick entry: sentence fills the form, nothing saved until Salvar',()=>{const n0=stored().tx.length;
    $('qeText').value='gastei 12,34 na feira do bairro dia 3';$('qeForm').dispatchEvent(new Event('submit',{cancelable:true}));
    need($('txForm').closest('#shBody'),'form not opened');need($('fVal').value==='R$ 12,34','value '+$('fVal').value);
    need(/^Feira do bairro$/.test($('fDesc').value),'desc '+$('fDesc').value);need($('fDate').value.endsWith('-03'),'date '+$('fDate').value);
    need(!$('fNote').hidden&&/Entendi: despesa/.test($('fNote').textContent)&&/categoria/.test($('fNote').textContent),'note: '+$('fNote').textContent);
    need(stored().tx.length===n0,'saved before confirming');
    $('fCat').value='Mercado';$('fSave').click();need(stored().tx.length===n0+1,'not saved after Salvar');need(!$('sheet').open,'sheet still open');});
  await step('history suggestion: same description offers its category (never applied alone)',()=>{$('fab').click();$('fCat').value='';$('fDesc').value='Feira do bairro';$('fDesc').dispatchEvent(new Event('input',{bubbles:true}));
    const b=q('#descSug [data-sug]');need(b&&/Mercado/.test(b.textContent),'no suggestion');need($('fCat').value==='','category applied without a tap');
    b.click();need($('fCat').value==='Mercado','tap did not apply');need(!q('#descSug [data-sug]'),'suggestion still shown');$('shClose').click();});
  await step('repeat a record: copy opens filled, original untouched',()=>{q('#bnav [data-t=lanc]').click();const m=stored().tx.find(t=>t.desc==='Feira do bairro');need(m,'record');
    const open=()=>{$('qBox').value='Feira do bairro';$('qBox').dispatchEvent(new Event('input'));qa('#txList [data-tx]')[0].click();};open();
    q('#shFoot [data-act=dup]').click();need($('txForm').closest('#shBody'),'form');need($('fVal').value==='R$ 12,34','value '+$('fVal').value);need(/Cópia de/.test($('fNote').textContent),'note');
    need($('fDate').value===new Date().toLocaleDateString('sv'),'date should be today');$('fSave').click();
    need(stored().tx.filter(t=>t.desc==='Feira do bairro').length===2,'copy not saved');need(stored().tx.find(t=>t.id===m.id).date===m.date,'original changed');
    if($('sheet').open)$('shClose').click();$('qBox').value='';$('qBox').dispatchEvent(new Event('input'));});
  // import: only CSV/OFX, preview first, edit, confirm, result, same file again does not duplicate
  const csv=['Data;Descrição;Valor','02/09/2026;SALDO ANTERIOR;1.000,00','03/09/2026;PADARIA TESTE UM;-13,37','04/09/2026;EMPRESA TESTE SA SALARIO;4.321,09','05/09/2026;PAGAMENTO FATURA CARTAO;-900,00','06/09/2026;LOJA TESTE PARC 02/03;-77,77','07/09/2026;PADARIA TESTE UM;-13,37'].join('\n');
  let n0=0;
  await step('import: panel states the formats honestly and refuses PDF/photo',async()=>{q('#bnav [data-t=lanc]').click();$('impOpen').click();need($('sheet').open&&$('impDrop'),'panel');
    need(/CSV/.test(q('.imp-formats').textContent)&&/OFX/.test(q('.imp-formats').textContent)&&/PDF digital/.test(q('.imp-formats').textContent)&&/Foto, PDF escaneado e Excel: ainda não/.test(q('.imp-formats').textContent),'formats');
    await chooseFile('extrato.pdf','this is not a pdf');await waitFor(()=>!$('impErr').hidden,'pdf error',6000);need(/Não consegui abrir este PDF/.test($('impErr').textContent),'pdf msg: '+$('impErr').textContent);need($('confirmDlg').open&&/Não consegui importar/.test($('cfTitle').textContent)&&/extrato\.pdf/.test($('cfText').textContent),'error pop-up');
    await chooseFile('foto.jpg','x');await waitFor(()=>/Ainda não leio foto/.test($('impErr').textContent),'photo error');});
  await step('import: preview shows what was read and saves nothing',async()=>{n0=stored().tx.length;await chooseFile('extrato.csv',csv);await waitFor(()=>q('#impList .imp-row'),'review');
    need(/nada foi gravado/i.test($('impSum').textContent),'no preview warning');need(qa('#impList .imp-row').length===5,'rows '+qa('#impList .imp-row').length);
    need(!qa('#impList .imp-desc').some(e=>/SALDO/.test(e.textContent)),'balance listed as entry');
    need(qa('#impList .imp-row.ign').length===1&&!q('#impList .imp-row.ign input').checked,'invoice payment should be unselected');
    need(/Lidos/.test($('impSum').textContent)&&/R\$ 4\.321,09/.test($('impSum').textContent),'totals '+$('impSum').textContent.slice(0,200));
    need(stored().tx.length===n0,'saved before confirming');});
  await step('import: edit a row, remove one, select/deselect',()=>{const row=qa('#impList .imp-item')[0];row.querySelector('[data-imp-open]').click();
    const ed=q('#impList .imp-edit');need(ed,'editor not opened');const f=ed.querySelector('[data-f=cat]');f.value='Restaurantes';f.dispatchEvent(new Event('change',{bubbles:true}));
    need(/Restaurantes/.test(q('#impList .imp-row').textContent),'card not updated');q('#impList [data-imp-close]').click();need(!q('#impList .imp-edit'),'editor still open');
    const dupRow=qa('#impList .imp-item')[4];dupRow.querySelector('[data-imp-open]').click();q('#impList [data-imp-del]').click();need(qa('#impList .imp-row').length===4,'row not removed from the import');
    need(stored().tx.length===n0,'delete in review touched saved data');
    q('[data-imp-all="0"]').click();need(/Selecionados: 0/.test($('impSum').textContent)&&$('impGo').disabled,'deselect all');q('[data-imp-all="1"]').click();
    need(!q('#impList .imp-row.ign input').checked,'select all must not select non-importable rows');});
  await step('import: divide a row across categories, the rest stays in the main one',()=>{const row=qa('#impList .imp-item')[0];row.querySelector('.imp-main').click();
    need(/Dividir em categorias/.test(q('#impList .imp-edit').textContent),'no split option');q('#impList [data-sp-add]').click();
    const c=q('#impList [data-sp-cat="0"]'),v=q('#impList [data-sp-val="0"]');need(c&&v,'part fields');need(document.activeElement===c,'focus on the new part');
    c.value='Mercado';c.dispatchEvent(new Event('change',{bubbles:true}));v.value='3,37';v.dispatchEvent(new Event('input',{bubbles:true}));
    need(/Resto em Restaurantes: R\$\s?10,00/.test(q('#impList [data-sp-sum]').textContent),'rest '+q('#impList [data-sp-sum]').textContent);
    v.value='50,00';v.dispatchEvent(new Event('change',{bubbles:true}));need(/passam do valor/.test(q('#impList [data-sp-sum]').textContent)&&/Divisão/.test(q('#impList .imp-row').textContent),'over the value must be blocked');
    v.value='3,37';v.dispatchEvent(new Event('change',{bubbles:true}));need(/Restaurantes \+ 1 parte/.test(q('#impList .imp-row').textContent),'card: '+q('#impList .imp-row .imp-meta').textContent);
    q('#impList [data-imp-close]').click();});
  await step('import: confirm shows the totals, then the result per item',async()=>{need(!$('impGo').disabled,'button disabled');$('impGo').click();await tick();need($('confirmDlg').open,'no confirmation');
    need(/R\$ 4\.321,09/.test($('cfText').textContent),'totals in confirmation: '+$('cfText').textContent);$('cfOk').click();await waitFor(()=>q('.imp-ok'),'result');
    need(/3 lançamento/.test(q('.imp-ok').textContent),'result '+q('.imp-ok').textContent);const t=stored().tx;need(t.length===n0+3,'saved '+(t.length-n0));
    need(t.some(x=>x.date==='2026-09-04'&&x.type==='receita'&&x.value===4321.09&&x.imp),'income with exact date/value/key');
    need(!$('impFix'),'nothing failed, so no "fix" button');need(t.filter(x=>x.desc==='PADARIA TESTE UM').length===1,'padaria count');const pd=t.find(x=>x.desc==='PADARIA TESTE UM');need(pd.cat==='Restaurantes'&&JSON.stringify(pd.splits)==='[{"cat":"Mercado","value":3.37}]','split not saved: '+JSON.stringify(pd));need(!t.some(x=>/FATURA|SALDO/.test(x.desc||'')),'ignored rows saved');});
  await step('import: the same file again does not duplicate',async()=>{$('impDone').click();need(!$('sheet').open,'sheet open');n0=stored().tx.length;$('impOpen').click();await chooseFile('extrato.csv',csv);
    await waitFor(()=>q('#impList .imp-row'),'review 2');need(/já foi importado/.test($('impSum').textContent),'file recognised? '+$('impSum').textContent.slice(0,300));
    need(qa('#impList .imp-row.dup').length===3,'duplicates flagged: '+qa('#impList .imp-row.dup').length);need(qa('#impList .imp-row.dup input:checked').length===0,'duplicates should start unselected');
    need(qa('#impList .imp-row input:checked').length===1&&/Importar 1 lançamento/.test($('impGo').textContent),'only the row the user dropped before is new: '+$('impGo').textContent);$('impCancel').click();need(!$('sheet').open,'cancel did not close');need(stored().tx.length===n0,'cancel changed data');});
  await step('import: an old statement keeps its historical months',()=>{const t=stored().tx.filter(x=>x.imp);need(t.length===3&&t.every(x=>x.date.startsWith('2026-09')),'dates moved: '+t.map(x=>x.date));});
  await step('transfers between own accounts: name in Ajustes, Pix to myself is kept apart, the other bank recognises it, fix a saved side',async()=>{
    if($('sheet').open)$('shClose').click();q('#nav [data-t=cfg]').click();
    $('ownNameIn').value='Zuleica';$('ownNameAdd').click();await tick();need(!(stored().ownNames||[]).length,'single word accepted');
    $('ownNameIn').value='Zuleica Pimentel Tavares';$('ownNameAdd').click();await tick();need((stored().ownNames||[]).length===1&&/Zuleica Pimentel Tavares/.test($('ownNames').textContent),'name not saved/shown');
    const tx0=stored().tx.length;
    q('#bnav [data-t=lanc]').click();$('impOpen').click();
    await chooseFile('santander-out.csv','Data;Descrição;Valor\n12/10/2026;PIX ENVIADO ZULEICA P TAVARES;-7.000,00\n12/10/2026;PIX ENVIADO OUTRA PESSOA;-33,00\n13/10/2026;PIX ENVIADO ALGUEM;-2.500,00');
    await waitFor(()=>q('#impList .imp-row'),'review transfer');
    need(/Transferências suas/.test($('impSum').textContent),'transfer tile missing');need(/🔁 Transferência minha/.test($('impList').textContent),'transfer type label');
    need(/\+ 1 transf/.test($('impGo').textContent),'footer: '+$('impGo').textContent);
    $('impGo').click();await tick();need(/Transferências entre suas contas/.test($('cfText').textContent),'confirm text: '+$('cfText').textContent);$('cfOk').click();await waitFor(()=>q('.imp-done'),'result');
    need(/transferência\(s\) entre suas contas guardada/.test(q('.imp-done').textContent),'result text');
    const st=stored();need(st.tx.length===tx0+2&&(st.transfers||[]).length===1&&!st.tx.some(t=>t.value===7000),'saved wrong: tx '+(st.tx.length-tx0)+' transfers '+(st.transfers||[]).length);
    $('impDone').click();$('impOpen').click();
    await chooseFile('nubank-in.csv','Data;Descrição;Valor\n13/10/2026;Transferência recebida;7.000,00\n14/10/2026;Pix recebido;2.500,00');
    await waitFor(()=>q('#impList .imp-row'),'review other side');
    need(/reconhecida como transferência/.test($('impList').textContent),'pair with kept transfer not shown');
    const fix=q('[data-imp-pairfix="1"]');need(fix,'no "fix both" button for the side saved as expense');
    fix.closest('[data-imp-item]').querySelector('[data-imp-pairfix]').click();await tick();
    need(/ao importar, ele também vira transferência/.test($('impList').textContent),'fix not marked');
    $('impGo').click();await tick();need(/vão virar transferência/.test($('cfText').textContent),'confirm does not warn about the fix');$('cfOk').click();await waitFor(()=>q('.imp-done'),'result 2');
    const s2=stored();need((s2.transfers||[]).length===4&&(s2.transfers||[]).every(t=>t.pair)&&!s2.tx.some(t=>t.value===2500||t.value===7000),'other sides wrong: transfers '+(s2.transfers||[]).length);
    $('impDone').click();
    q('#nav [data-t=cfg]').click();need(/4 transferência/.test($('ownNames').textContent),'settings count');
    q('[data-own-del]').click();await tick();need(!(stored().ownNames||[]).length,'remove name');});
  await step('a Pix to myself that was in fact spent: becomes an expense divided across categories',async()=>{
    q('#nav [data-t=cfg]').click();$('ownNameIn').value='Zuleica Pimentel Tavares';$('ownNameAdd').click();await tick();
    const tx0=stored().tx.length,tr0=(stored().transfers||[]).length;q('#bnav [data-t=lanc]').click();$('impOpen').click();
    await chooseFile('pix-gasto.csv','Data;Descrição;Valor\n20/10/2026;PIX ENVIADO ZULEICA P TAVARES;-1.176,00');await waitFor(()=>q('#impList .imp-row'),'review spent');
    q('#impList .imp-main').click();need(!q('#impList [data-sp-add]'),'a transfer has no categories to divide');
    const b=q('#impList [data-sp-spent]');need(b,'no "money was spent" option');b.click();await tick();
    need(q('#impList [data-f=type]').value==='despesa'&&q('#impList [data-sp-cat="0"]'),'not an expense with a part');
    const c=q('#impList [data-f=cat]');c.value='Saúde';c.dispatchEvent(new Event('change',{bubbles:true}));
    const pc=q('#impList [data-sp-cat="0"]'),pv=q('#impList [data-sp-val="0"]');pc.value='Presente';pc.dispatchEvent(new Event('change',{bubbles:true}));pv.value='750,00';pv.dispatchEvent(new Event('change',{bubbles:true}));
    need(/Resto em Saúde: R\$\s?426,00/.test(q('#impList [data-sp-sum]').textContent),'rest '+q('#impList [data-sp-sum]').textContent);
    $('impGo').click();await tick();if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>q('.imp-done'),'result spent');
    const st=stored(),t=st.tx.find(x=>x.value===1176);need(st.tx.length===tx0+1&&t&&t.type==='despesa'&&t.cat==='Saúde'&&JSON.stringify(t.splits)==='[{"cat":"Presente","value":750}]','saved: '+JSON.stringify(t));
    need((st.transfers||[]).length===tr0,'kept as a transfer too');
    $('impDone').click();q('#nav [data-t=cfg]').click();q('[data-own-del]').click();await tick();need(!(stored().ownNames||[]).length,'remove name');});
  await step('aporte to an investment account that does not exist yet: created on confirm',async()=>{
    const acc0=stored().accounts.length,tx0=stored().tx.length;q('#bnav [data-t=lanc]').click();$('impOpen').click();
    await chooseFile('aporte-novo.csv','Data;Descrição;Valor\n06/11/2026;PIX ENVIADO CORRETORA TESTE;-3.000,00');await waitFor(()=>q('#impList .imp-row'),'review aporte');
    q('#impList .imp-main').click();need(q('#impList [data-sp-add] svg'),'split button without icon');
    const ty=q('#impList [data-f=type]');ty.value='aporte';ty.dispatchEvent(new Event('change',{bubbles:true}));
    const sel=q('#impList [data-f=acc]');need(sel&&[...sel.options].some(o=>/Criar conta nova/.test(o.textContent)),'no "new account" option');
    sel.value='__new';sel.dispatchEvent(new Event('change',{bubbles:true}));
    need(/dê um nome à conta nova/.test(q('#impList .imp-row').textContent)&&/conta nova/.test(q('#impList .imp-row').textContent),'card does not ask for the name');
    need(stored().accounts.length===acc0,'account created in the preview');
    const nm=q('#impList [data-f=newAcc]');need(nm,'no name field');nm.value='Corretora Teste';nm.dispatchEvent(new Event('change',{bubbles:true}));
    need(/Corretora Teste \(conta nova\)/.test(q('#impList .imp-row').textContent),'card: '+q('#impList .imp-row .imp-meta').textContent);
    $('impGo').click();await tick();if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>q('.imp-done'),'result aporte');
    need(/Corretora Teste/.test(q('.imp-done').textContent),'result does not say the account was created');
    const st=stored(),a=st.accounts.find(x=>x.name==='Corretora Teste');need(st.accounts.length===acc0+1&&a,'account not created');
    need(st.tx.length===tx0+1&&st.tx.some(t=>t.type==='aporte'&&t.value===3000&&t.acc===a.id),'aporte not saved to the new account');
    $('impDone').click();});
  await step('printed report: filled when printing, plain language, only the month on screen; e-mail link with subject and summary',async()=>{
    q('#nav [data-t=resumo]').click();
    need($('printReport')&&getComputedStyle($('printReport')).display==='none','the report must be hidden on screen');
    window.dispatchEvent(new Event('beforeprint'));const rp=$('printReport');
    need(rp.querySelector('h1')&&/Relatório financeiro/.test(rp.textContent),'report not filled before printing');
    need(/Entrou/.test(rp.textContent)&&/Saiu/.test(rp.textContent)&&/Sobrou/.test(rp.textContent)&&/Meta de R\$/.test(rp.textContent),'main sections missing: '+rp.textContent.slice(0,300));
    need(rp.querySelector('svg.rp-bar')&&!rp.querySelector('[style]'),'bars must be SVG, with no inline styles');
    need(new RegExp(q('#mLab1').textContent.trim().split(' ')[0],'i').test(rp.querySelector('h1').textContent),'report month differs from the screen: '+rp.querySelector('h1').textContent);
    const links=[];const spy=e=>{const a=e.target.closest&&e.target.closest('a[href^="mailto:"]');if(a){e.preventDefault();links.push(a.href);}};
    document.addEventListener('click',spy,true);$('mailBtn').click();document.removeEventListener('click',spy,true);
    need(links.length===1,'e-mail link not opened');const u=decodeURIComponent(links[0]);
    need(/^mailto:\?subject=Relatório financeiro: /.test(u)&&/Entrou: R\$/.test(u)&&/Imprimir \/ PDF/.test(u),'mail text: '+u.slice(0,200));
    need(links[0].length<2600,'mail link too long: '+links[0].length);});
  await step('holder name: suggested from the salary line, "Sim, sou eu" saves it; records saved before are fixed in Ajustes',async()=>{
    q('#bnav [data-t=lanc]').click();$('impOpen').click();
    await chooseFile('antes.csv','Data;Descrição;Valor\n02/09/2026;PIX ENVIADO Joana Prado Leite;-4.000,00\n03/09/2026;PIX ENVIADO Padaria;-12,00');
    await waitFor(()=>q('#impList .imp-row'),'review 1');need(!q('[data-imp-own]'),'hint without a salary line');
    $('impGo').click();await tick();if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>q('.imp-done'),'result 1');$('impDone').click();
    need(stored().tx.some(t=>t.value===4000&&t.type==='despesa'),'first Pix not saved as expense');
    $('impOpen').click();
    await chooseFile('depois.csv','Data;Descrição;Valor\n01/10/2026;TED CONTA SALARIO JOANA PRADO LEITE;9.000,00\n02/10/2026;PIX ENVIADO Joana Prado Leite;-3.000,00');
    await waitFor(()=>q('#impList .imp-row'),'review 2');
    const hint=q('[data-imp-own]');need(hint&&/Joana Prado Leite/.test(q('.imp-own-hint').textContent),'no hint');
    hint.click();await tick();need(!q('[data-imp-own]')&&/Transferências suas/.test($('impSum').textContent),'Pix not a transfer after "Sim, sou eu"');
    need((stored().ownNames||[]).includes('Joana Prado Leite'),'name not saved');
    $('impGo').click();await tick();if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>q('.imp-done'),'result 2');$('impDone').click();
    q('#nav [data-t=cfg]').click();need(q('#ownFix')&&/1<\/b> lançamento/.test($('ownNames').innerHTML),'no fix offer in Ajustes');
    $('ownFix').click();await tick();need(/Joana Prado Leite/.test($('cfText').textContent),'confirm lists the record');$('cfOk').click();await tick();
    need(!stored().tx.some(t=>t.value===4000)&&stored().transfers.some(t=>t.value===4000&&t.dir==='out'),'not moved to transfers');need(!q('#ownFix'),'fix offer still shown');
    q('[data-own-del]').click();await tick();});
  const b64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
  const choosePdf=async(name,b64text)=>{const dt=new DataTransfer();dt.items.add(new File([b64(b64text)],name,{type:'application/pdf'}));const i=$('impFile');i.files=dt.files;i.dispatchEvent(new Event('change'));if($('confirmDlg').open)$('cfOk').click();await waitFor(()=>$('impSend')&&$('impDrop').textContent.includes(name),'send button for '+name);need(/Enviar/.test($('impSend').textContent),'send label');$('impSend').click();};
  await step('import PDF: a digital statement spanning two months is split by date',async()=>{n0=stored().tx.length;$('impOpen').click();await choosePdf('extrato-teste.pdf',window.PDF_FIXTURE.bank);
    await waitFor(()=>q('#impList .imp-row')||!$('impErr').hidden,'pdf review',6000);if(!q('#impList .imp-row'))throw new Error('pdf not read: '+$('impErr').textContent);
    need(/PDF/.test($('impSum').textContent)&&/aproximada/.test($('impSum').textContent),'no approximate-reading notice');
    need(qa('#impList .imp-row').length===4,'rows '+qa('#impList .imp-row').length+': '+qa('#impList .imp-desc').map(e=>e.textContent));
    need(/set\/26, out\/26/.test($('impSum').textContent),'months '+$('impSum').textContent.slice(0,400));
    need(stored().tx.length===n0,'saved before confirming');$('impGo').click();await tick();$('cfOk').click();await waitFor(()=>q('.imp-ok'),'pdf result');
    const t=stored().tx.filter(x=>/MERCADO TESTE|SALARIO EMPRESA TESTE|LUZ TESTE|AMIGO TESTE/.test(x.desc||'')&&x.imp);
    need(t.length===4,'saved '+t.length);
    const by=d=>t.find(x=>x.desc.startsWith(d));
    need(by('COMPRA MERCADO').date==='2026-09-03'&&by('COMPRA MERCADO').type==='despesa'&&by('COMPRA MERCADO').value===45.67,'mercado');
    need(by('SALARIO').date==='2026-09-15'&&by('SALARIO').type==='receita'&&by('SALARIO').value===3210.98,'salario');
    need(by('PAGAMENTO LUZ').date==='2026-10-05'&&by('PAGAMENTO LUZ').type==='despesa','luz in october');
    need(by('PIX RECEBIDO').date==='2026-10-20'&&by('PIX RECEBIDO').type==='receita'&&by('PIX RECEBIDO').value===100,'pix in october');
    $('impDone').click();});
  await step('custody PDF with no investment account: create the account right there (name from the statement)',async()=>{
    const accs0=stored().accounts.filter(a=>!a.archived).map(a=>a.id),arch=stored().accounts.length,tx0=stored().tx.length;
    $('impOpen').click();await choosePdf('custodia-teste.pdf',window.PDF_FIXTURE.custody);
    if($('impSend')&&!$('impSend').disabled)$('impSend').click();
    await waitFor(()=>$('cuAcc'),'custody screen');
    need([...$('cuAcc').options].some(o=>/Criar conta nova/.test(o.textContent)),'no "create account" option');
    $('cuAcc').value='__new';$('cuAcc').dispatchEvent(new Event('change'));await tick();
    need($('cuNew')&&$('cuNew').value==='Nubank Caixinhas','suggested name: '+($('cuNew')&&$('cuNew').value));
    $('cuNew').value='';$('cuNew').dispatchEvent(new Event('input'));need($('cuGo').disabled,'empty name accepted');
    $('cuNew').value='Nubank Caixinhas';$('cuNew').dispatchEvent(new Event('input'));need(!$('cuGo').disabled,'button disabled with a name');
    $('cuGo').click();await confirmYes();await waitFor(()=>!$('sheet').open,'sheet closed');
    const a=stored().accounts.find(x=>x.name==='Nubank Caixinhas'&&!accs0.includes(x.id));need(a&&stored().accounts.length===arch+1,'account not created');
    need(stored().snaps.some(s=>s.acc===a.id&&s.date==='2026-11-10'&&s.value===4900&&s.gross===5000),'balance not saved in the new account');
    need(stored().tx.length===tx0,'a transaction was created');});
  await step('import PDF: card invoice (month names) becomes card expenses; payment is not imported',async()=>{n0=stored().tx.length;$('impOpen').click();await choosePdf('fatura-teste.pdf',window.PDF_FIXTURE.card);
    await waitFor(()=>q('#impList .imp-row')||!$('impErr').hidden,'card pdf review',6000);if(!q('#impList .imp-row'))throw new Error('pdf not read: '+$('impErr').textContent);
    need(/fatura do cartão/.test($('impSum').textContent),'kind');need(qa('#impList .imp-row').length===3&&qa('#impList .imp-row.ign').length===1,'rows');
    $('impGo').click();await tick();$('cfOk').click();await waitFor(()=>q('.imp-ok'),'card result');
    const t=stored().tx.slice(n0);need(t.length===2&&t.every(x=>x.fonte==='cartao'&&x.type==='despesa'),'card expenses: '+JSON.stringify(t.map(x=>[x.desc,x.fonte])));
    need(t.some(x=>x.date==='2026-09-28'&&x.value===100)&&t.some(x=>x.date==='2026-10-05'&&x.value===50.5),'dates/values');$('impDone').click();});
  // goal + projection in one tab
  await step('Patrimônio: balances first, one chart (projection + lower rate + goal), the table collapsed, account actions in ⋯',()=>{
    need(!q('#nav [data-t=proj]'),'proj tab still there');q('#nav [data-t=meta]').click();
    need(!$('chProj'),'second chart still there');need($('chTower').innerHTML.length>100,'chart empty');need(/Se juros caírem/.test($('lgTower').textContent),'no lower-rate line in the legend');
    need(/Meta/.test($('chTower').textContent),'goal not shown in the chart');
    const pc=$('projCard');need(pc&&pc.tagName==='DETAILS'&&!pc.open&&$('t-meta').contains(pc),'projection table not collapsed');need(/\(\d+ linhas\)/.test($('projSum').textContent),'summary '+$('projSum').textContent);
    const top=id=>$(id).getBoundingClientRect().top;need(top('accList')<top('distCard')&&top('distCard')<top('chTower'),'order: balances, distribution, chart');
    need(!qa('#accList > .acc > button').length,'buttons still inside each account row');
    const menu=q('#accList details.more');if(menu){menu.open=true;const r=menu.querySelector('[data-reserve]');need(r,'no reserve action');r.click();
      need(q('#accList .acc-badge'),'reserve badge not shown');q('#accList [data-reserve][aria-pressed=true]').click();need(!q('#accList .acc-badge'),'reserve not removed');}});

  // card: purchase, partial payment, cancel payment
  await step('enter card purchase',()=>{$('fab').click();const r=q('input[name=tp][value=despesa]');r.checked=true;r.dispatchEvent(new Event('change'));
    type($('fVal'),'5000');$('fCat').value='Mercado';$('fFonte').value='cartao';$('fDate').value=new Date().toLocaleDateString('sv');$('fSave').click();need(!$('sheet').open,'not saved');});
  await step('pay invoice (partial) with confirmation',async()=>{$('fab').click();
    const r=q('input[name=tp][value=fatura]');if(!r.checked){r.checked=true;r.dispatchEvent(new Event('change'));}
    need($('payBox').innerHTML.includes('Qual fatura'),'no invoice list');
    if(!q('input[name=payM][value=part]'))q('[data-pa]').click();
    q('input[name=payM][value=part]').click();type($('payVal'),'1000');need($('payVal').value==='R$ 10,00','pay mask '+$('payVal').value);
    $('payGo').click();await confirmYes();need(q('[data-cp]'),'payment not registered');});
  await step('cancel payment with confirmation',async()=>{q('[data-cp]').click();await confirmYes();});
  if($('sheet').open)$('shClose').click();

  await step('Cartão: ‹ › select the invoice, purchases as list rows, total as a plain line, same name as the Summary',()=>{
    q('#bnav [data-t=cartao]').click();need(!q('#t-cartao .mnav'),'month arrows still on the Card tab');
    const name=()=>q('#cycleBox .cc-name b').textContent,n0=name();need(/^Fatura de [a-zç]{3}\/\d\d$/.test(n0),'name '+n0);
    const box=q('#cycleBox .cc-detail');need(!box.querySelector('table'),'purchases still in a table');
    need(qa('#cycleBox .cc-detail .lst [data-tx]').some(r=>/50,00/.test(r.textContent)),'purchase not listed');
    const tot=q('#cycleBox .cc-total');need(tot&&/Total da fatura/.test(tot.textContent)&&money(tot.querySelector('b').textContent)===money(q('#cycleBox .cc-amount').textContent),'total line');
    need(/Nenhum pagamento lançado/.test(box.textContent),'no paid note');
    q('#cycleBox [data-cyc-mv="1"]').click();need(name()!==n0&&q('#cycleBox [data-cyc-now]'),'arrow did not move the invoice');
    q('#cycleBox [data-cyc-mv="-1"]').click();need(name()===n0,'back');q('#cycleBox [data-cyc-mv="1"]').click();q('#cycleBox [data-cyc-now]').click();need(name()===n0,'Atual');
    q('#bnav [data-t=resumo]').click();q('#t-resumo [data-mtoday]')&&!q('#t-resumo [data-mtoday]').hidden&&q('#t-resumo [data-mtoday]').click();
    const hero=$('monthHero').textContent;need(!/Fatura de/.test(hero)||hero.includes(n0),'Summary names it differently: '+hero);});
  await step('disable category',()=>{const c=q('[data-co]');need(c,'no toggle');c.checked=false;c.dispatchEvent(new Event('change'));c.checked=true;c.dispatchEvent(new Event('change'));});
  await step('tabs (top and bottom menu)',()=>{qa('#nav button').forEach(b=>b.click());q('#bnav [data-t=more]').click();need($('sheet').open,'more menu');q('[data-more=cfg]').click();need($('t-cfg').classList.contains('on'),'tab');});
  await step('investments: import starts in investment mode (money in = aporte) and needs the destination account',async()=>{
    if($('sheet').open)$('shClose').click();document.querySelector('#nav [data-t=meta]').click();$('newAcc').value='Tesouro Selic 2028';$('addAcc').click();$('impOpenInv').click();need(/investimentos/i.test($('shTitle').textContent),'title '+$('shTitle').textContent);
    await chooseFile('aportes.csv','Data;Descrição;Valor\n03/11/2026;APORTE TESOURO SELIC 2028;2.000,00\n04/11/2026;RENDIMENTO;35,10');
    await waitFor(()=>q('#impList .imp-row'),'invest review');const rows=qa('#impList .imp-row');
    need(/Aporte/.test(rows[0].textContent)&&/Tesouro Selic 2028/.test(rows[0].textContent),'first row: '+rows[0].textContent.slice(0,200));
    need(rows[1].classList.contains('ign'),'yield should be ignored');$('shClose').click();});
  await step('investments: a brokerage note fills the portfolio, grouped by kind, and importing it again adds nothing',async()=>{
    const note='NOTA DE NEGOCIAÇÃO\nData pregão 05/11/2026\n1-BOVESPA C VISTA PETR4 PN N2 100 38,20 3.820,00 D\n1-BOVESPA C VISTA FII HGLG CI ER 40 158,00 6.320,00 D\nTotal custos / despesas 10,00 D';
    if($('sheet').open)$('shClose').click();document.querySelector('#nav [data-t=meta]').click();const n0=stored().tx.length;
    $('impOpenInv').click();await chooseFile('nota.txt',note);await waitFor(()=>q('#ntList .imp-row'),'note review');
    need(qa('#ntList .imp-row').length===2&&/Nota de corretagem/.test($('shTitle').textContent),'note rows');
    need(stored().tx.length===n0,'saved before confirming');
    $('ntGo').click();await tick();$('cfOk').click();await waitFor(()=>!$('sheet').open,'note saved');
    need(stored().tx.length===n0+2,'aportes '+(stored().tx.length-n0));
    const pf=$('portfolio').textContent;need(/Ações/.test(pf)&&/FIIs/.test(pf)&&/PETR4/.test(pf)&&/HGLG11/.test(pf),'portfolio: '+pf.slice(0,200));
    $('impOpenInv').click();await chooseFile('nota.txt',note);await waitFor(()=>q('#ntList .imp-row'),'note review 2');$('ntGo').click();await tick();$('cfOk').click();await waitFor(()=>!$('sheet').open,'note again');
    need(stored().tx.length===n0+2,'duplicated aportes');});
  await step('new category: asks first, suggests the closest, cancel keeps the form',async()=>{const n0=stored().tx.length;
    $('fab').click();type($('fVal'),'1234');$('fCat').value='Mercadoo';$('fSave').click();await tick();
    need($('confirmDlg').open&&/Mercadoo/.test($('cfText').textContent)&&!$('cfAlt').hidden&&/Mercado”/.test($('cfAlt').textContent),'no question: '+$('cfText').textContent);
    await confirmNo();need($('sheet').open&&$('fVal').value==='R$ 12,34','form lost on cancel');need(stored().tx.length===n0,'saved on cancel');
    $('fSave').click();await tick();$('cfAlt').click();await tick();
    const t=stored().tx.find(x=>x.value===12.34);need(t&&t.cat==='Mercado','suggestion not used: '+(t&&t.cat));
    need(!stored().cats.despesa.some(c=>c.name==='Mercadoo'),'category created anyway');
    $('fab').click();type($('fVal'),'4321');$('fCat').value='mercado';$('fSave').click();await tick();
    need(!$('confirmDlg').open,'asked about a case difference');need(stored().tx.find(x=>x.value===43.21).cat==='Mercado','case not fixed');});
  await step('"Pago com" starts with the last method used',()=>{$('fab').click();type($('fVal'),'555');$('fCat').value='Mercado';$('fFonte').value='beneficio';
    $('fFonte').dispatchEvent(new Event('change'));$('fSave').click();need(!$('sheet').open,'not saved');
    $('fab').click();need($('fFonte').value==='beneficio','started with '+$('fFonte').value);$('shClose').click();});
  await step('remove test data',async()=>{$('demoOff').click();await confirmYes();need(!/lançamentos de teste/.test($('demoN').textContent),'still there');
    need(!/teste/.test($('accList').textContent)&&!/teste/.test($('portfolio').textContent),'demo investments still there');});
  await step('generate test data fills investments and portfolio; "Apagar tudo" leaves nothing',async()=>{
    $('demoOn').click();await tick();if($('confirmDlg').open)$('cfOk').click();await tick();
    need(/Renda fixa \(teste\)/.test($('accList').textContent),'demo account missing');need(/PETR4/.test($('portfolio').textContent),'demo portfolio missing');
    const circles=qa('#distCard svg.donut circle[data-key]').length,calls=qa('#distCard .donut-call'),pcts=calls.map(c=>parseFloat(c.querySelector('.donut-pct').textContent.replace(',','.')));
    need(circles>=4&&circles===calls.length,'slices '+circles+' vs labels '+calls.length);need(Math.abs(pcts.reduce((a,b)=>a+b,0)-100)<0.6,'label % sum '+pcts.reduce((a,b)=>a+b,0));
    need(!$('distCard').querySelector('.dist-legend'),'no separate legend');
    const ys=side=>calls.filter(c=>c.querySelector('.donut-name').getAttribute('text-anchor')===side).map(c=>+c.querySelector('.donut-name').getAttribute('y')).sort((x,y)=>x-y);
    need(['start','end'].every(sd=>ys(sd).every((y,i,a)=>i===0||y-a[i-1]>=20)),'labels overlap: '+ys('start')+' | '+ys('end'));
    q('[data-dist-by=type]').click();const tl=qa('#distCard .donut-name').map(e=>e.textContent);
    need(/Renda fixa/.test(tl.join('|'))&&/Ações/.test(tl.join('|')),'by type: '+tl);
    qa('#distCard .donut-call')[0].dispatchEvent(new MouseEvent('click',{bubbles:true}));need($('distCard').querySelectorAll('.donut circle[opacity]').length>=1&&/R\$/.test($('distCard').querySelector('.donut-top').textContent),'selecting a label dims the others');
    qa('#distCard .donut-call')[0].dispatchEvent(new MouseEvent('click',{bubbles:true}));need(!$('distCard').querySelector('.donut circle[opacity]'),'second click clears');
    // allocation target: type a target for fixed income, the card shows the gap in money; clearing removes it
    q('[data-dist-by=type]').click();{const inp=q('[data-target=_fixed]');need(inp,'no target input');inp.value='50';inp.dispatchEvent(new Event('change',{bubbles:true}));await tick();await tick();
      need(/no alvo|acima|abaixo/.test($('distCard').querySelector('.tg-row').textContent),'no gap text after setting a target');
      need(stored().targets&&stored().targets._fixed===50,'target not saved');
      q('[data-target-clear]').click();await tick();await tick();need(!stored().targets||!Object.keys(stored().targets).length,'targets not cleared');}
    q('[data-dist-by=account]').click();
    $('reset').click();await confirmYes();await tick();await tick();
    need($('accList').children.length<=1,'accounts left: '+$('accList').textContent.slice(0,120));need(!/PETR4|HGLG11/.test($('portfolio').textContent),'portfolio left');
    need(stored().tx.length===0&&!(stored().trades||[]).length&&stored().snaps.length===0,'storage not empty');
    need(!sessionStorage.getItem('metaapp.trace'),'import log kept');q('#bnav [data-t=lanc]').click();$('impOpen').click();await tick();
    need(!/Detalhes técnicos/.test($('shBody').textContent),'import log still shown after "Apagar tudo"');$('shClose').click();});
  await step('first visit: welcome steps, no backup warning; a step opens the form',async()=>{
    q('#nav [data-t=resumo]').click();need(!$('startCard').hidden&&/Bem-vindo/.test($('startCard').textContent),'no welcome card');
    need(!$('bkNote').textContent.trim(),'backup warning on an empty app');
    q('[data-start=first-entry]').click();await tick();need($('sheet').open&&$('fVal'),'step did not open the form');$('shClose').click();});
  await step('"O que fazer agora" opens the right tab (card invoices -> Cartão)',async()=>{
    const d=new Date();d.setMonth(d.getMonth()-3);const old=d.toLocaleDateString('sv');
    $('fab').click();await tick();const r=document.querySelector('input[name=tp][value=despesa]');r.checked=true;r.dispatchEvent(new Event('change'));
    $('fVal').value='R$ 50,00';$('fCat').value='Mercado';$('fFonte').value='cartao';$('fDate').value=old;$('fSave').click();await tick();if($('confirmDlg').open)$('cfOk').click();await tick();
    if($('sheet').open)$('shClose').click();q('#nav [data-t=resumo]').click();
    const b=q('#todoCard [data-todo]');need(b&&/venceu|vencidas/.test(b.textContent),'no late invoice item: '+$('todoCard').textContent);
    b.click();need($('t-cartao').classList.contains('on'),'did not open the Card tab');});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

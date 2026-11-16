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
  await step('every summary card opens its records',()=>{for(const k of ['income','contrib','cash','opencard','voucher']){openKpi(k);need(q('#shBody .bd-total'),'no total for '+k);}$('shClose').click();});

  await step('analysis tiles and trend cards open their lists',()=>{for(const k of ['avg','fixed','variable','top3','lastmonth','trend']){
      const el=q(`#t-resumo [data-kpi=${k}]`);need(el,'no card '+k);el.click();need($('sheet').open&&q('#shBody .bd-total'),'nothing opened for '+k);$('shClose').click();}
    q('#t-resumo [data-kpi=avg]').click();const mrow=q('#shBody [data-go=month]');need(mrow,'no month row');mrow.click();need(/Despesas/.test($('shTitle').textContent),'month row did not open expenses');$('shClose').click();});
  await step('goal cards open their lists',()=>{q('#bnav [data-t=meta]').click();q('[data-kpi=networth]').click();need(rows().length===0&&qa('#shBody .li').length>0,'no accounts');$('shClose').click();q('[data-kpi=yield]').click();need($('sheet').open,'yield');$('shClose').click();q('#bnav [data-t=resumo]').click();});
  // detail, delete cancel, edit, delete
  let before=0,firstTitle='';
  await step('tap a record opens the detail',()=>{openKpi('expenses');before=rows().length;firstTitle=rows()[0].querySelector('.li-t').textContent;rows()[0].click();
    need(q('#shFoot [data-act=edit]')&&q('#shFoot [data-act=del]'),'no actions');need(!$('shBack').hidden,'no back button');});
  await step('delete asks for confirmation, cancel keeps it',async()=>{q('#shFoot [data-act=del]').click();await tick();
    need(/Deseja excluir/.test($('cfText').textContent)&&/R\$/.test($('cfText').textContent),'text: '+$('cfText').textContent);await confirmNo();
    need(q('#shFoot [data-act=del]'),'detail closed');$('shBack').click();need(rows().length===before,'removed after cancel: '+rows().length+' vs '+before+' title '+$('shTitle').textContent);});
  await step('edit saves without duplicating',()=>{rows()[0].click();q('#shFoot [data-act=edit]').click();need($('txForm').closest('#shBody'),'form not in sheet');
    need($('fVal').value.startsWith('R$'),'value not loaded');type($('fVal'),'77700');$('fSave').click();
    need(q('#shFoot [data-act=edit]'),'did not return to detail');need(/777,00/.test(q('#shBody .dt-v').textContent),'value not updated');
    $('shBack').click();need(rows().length===before,'duplicated: '+rows().length+' vs '+before);need(Math.abs(rowsSum()-Math.abs(sheetTotal()))<0.005,'total not refreshed');});
  await step('delete with confirmation removes it everywhere',async()=>{const card0=money(q('#kFlow [data-kpi=expenses] .v').textContent);
    rows()[0].click();q('#shFoot [data-act=del]').click();await confirmYes();
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
    el.value='Contas fixas';el.dispatchEvent(new Event('change'));
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
  await step('import: confirm shows the totals, then the result per item',async()=>{need(!$('impGo').disabled,'button disabled');$('impGo').click();await tick();need($('confirmDlg').open,'no confirmation');
    need(/R\$ 4\.321,09/.test($('cfText').textContent),'totals in confirmation: '+$('cfText').textContent);$('cfOk').click();await waitFor(()=>q('.imp-ok'),'result');
    need(/3 lançamento/.test(q('.imp-ok').textContent),'result '+q('.imp-ok').textContent);const t=stored().tx;need(t.length===n0+3,'saved '+(t.length-n0));
    need(t.some(x=>x.date==='2026-09-04'&&x.type==='receita'&&x.value===4321.09&&x.imp),'income with exact date/value/key');
    need(!$('impFix'),'nothing failed, so no "fix" button');need(t.filter(x=>x.desc==='PADARIA TESTE UM').length===1,'padaria count');need(!t.some(x=>/FATURA|SALDO/.test(x.desc||'')),'ignored rows saved');});
  await step('import: the same file again does not duplicate',async()=>{$('impDone').click();need(!$('sheet').open,'sheet open');n0=stored().tx.length;$('impOpen').click();await chooseFile('extrato.csv',csv);
    await waitFor(()=>q('#impList .imp-row'),'review 2');need(/já foi importado/.test($('impSum').textContent),'file recognised? '+$('impSum').textContent.slice(0,300));
    need(qa('#impList .imp-row.dup').length===3,'duplicates flagged: '+qa('#impList .imp-row.dup').length);need(qa('#impList .imp-row.dup input:checked').length===0,'duplicates should start unselected');
    need(qa('#impList .imp-row input:checked').length===1&&/Importar 1 lançamento/.test($('impGo').textContent),'only the row the user dropped before is new: '+$('impGo').textContent);$('impCancel').click();need(!$('sheet').open,'cancel did not close');need(stored().tx.length===n0,'cancel changed data');});
  await step('import: an old statement keeps its historical months',()=>{const t=stored().tx.filter(x=>x.imp);need(t.length===3&&t.every(x=>x.date.startsWith('2026-09')),'dates moved: '+t.map(x=>x.date));});
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
  await step('import PDF: card invoice (month names) becomes card expenses; payment is not imported',async()=>{n0=stored().tx.length;$('impOpen').click();await choosePdf('fatura-teste.pdf',window.PDF_FIXTURE.card);
    await waitFor(()=>q('#impList .imp-row')||!$('impErr').hidden,'card pdf review',6000);if(!q('#impList .imp-row'))throw new Error('pdf not read: '+$('impErr').textContent);
    need(/fatura do cartão/.test($('impSum').textContent),'kind');need(qa('#impList .imp-row').length===3&&qa('#impList .imp-row.ign').length===1,'rows');
    $('impGo').click();await tick();$('cfOk').click();await waitFor(()=>q('.imp-ok'),'card result');
    const t=stored().tx.slice(n0);need(t.length===2&&t.every(x=>x.fonte==='cartao'&&x.type==='despesa'),'card expenses: '+JSON.stringify(t.map(x=>[x.desc,x.fonte])));
    need(t.some(x=>x.date==='2026-09-28'&&x.value===100)&&t.some(x=>x.date==='2026-10-05'&&x.value===50.5),'dates/values');$('impDone').click();});
  // goal + projection in one tab
  await step('goal tab includes the projection (no separate tab)',()=>{need(!q('#nav [data-t=proj]'),'proj tab still there');q('#nav [data-t=meta]').click();
    need($('projCard')&&$('t-meta').contains($('projCard')),'projection not in goal tab');need($('chProj').innerHTML.length>100,'projection chart empty');});

  // card: purchase, partial payment, cancel payment
  await step('enter card purchase',()=>{$('fab').click();const r=q('input[name=tp][value=despesa]');r.checked=true;r.dispatchEvent(new Event('change'));
    type($('fVal'),'5000');$('fCat').value='Mercado';$('fFonte').value='cartao';$('fDate').value=new Date().toLocaleDateString('sv');$('fSave').click();need(!$('sheet').open,'not saved');});
  await step('pay invoice (partial) with confirmation',async()=>{q('[data-new=fatura]')?q('[data-new=fatura]').click():$('fab').click();
    const r=q('input[name=tp][value=fatura]');if(!r.checked){r.checked=true;r.dispatchEvent(new Event('change'));}
    need($('payBox').innerHTML.includes('Qual fatura'),'no invoice list');
    if(!q('input[name=payM][value=part]'))q('[data-pa]').click();
    q('input[name=payM][value=part]').click();type($('payVal'),'1000');need($('payVal').value==='R$ 10,00','pay mask '+$('payVal').value);
    $('payGo').click();await confirmYes();need(q('[data-cp]'),'payment not registered');});
  await step('cancel payment with confirmation',async()=>{q('[data-cp]').click();await confirmYes();});
  if($('sheet').open)$('shClose').click();

  await step('disable category',()=>{const c=q('[data-co]');need(c,'no toggle');c.checked=false;c.dispatchEvent(new Event('change'));c.checked=true;c.dispatchEvent(new Event('change'));});
  await step('tabs (top and bottom menu)',()=>{qa('#nav button').forEach(b=>b.click());q('#bnav [data-t=more]').click();need($('sheet').open,'more menu');q('[data-more=cfg]').click();need($('t-cfg').classList.contains('on'),'tab');});
  await step('investments: import starts in investment mode (money in = aporte) and needs the destination account',async()=>{
    if($('sheet').open)$('shClose').click();document.querySelector('[data-t=inv]').click();$('impOpenInv').click();need(/investimentos/i.test($('shTitle').textContent),'title '+$('shTitle').textContent);
    await chooseFile('aportes.csv','Data;Descrição;Valor\n03/11/2026;APORTE TESOURO SELIC 2028;2.000,00\n04/11/2026;RENDIMENTO;35,10');
    await waitFor(()=>q('#impList .imp-row'),'invest review');const rows=qa('#impList .imp-row');
    need(/Aporte/.test(rows[0].textContent)&&/Tesouro Selic 2028/.test(rows[0].textContent),'first row: '+rows[0].textContent.slice(0,200));
    need(rows[1].classList.contains('ign'),'yield should be ignored');$('shClose').click();});
  await step('investments: a brokerage note fills the portfolio, grouped by kind, and importing it again adds nothing',async()=>{
    const note='NOTA DE NEGOCIAÇÃO\nData pregão 05/11/2026\n1-BOVESPA C VISTA PETR4 PN N2 100 38,20 3.820,00 D\n1-BOVESPA C VISTA FII HGLG CI ER 40 158,00 6.320,00 D\nTotal custos / despesas 10,00 D';
    if($('sheet').open)$('shClose').click();document.querySelector('[data-t=inv]').click();const n0=stored().tx.length;
    $('impOpenInv').click();await chooseFile('nota.txt',note);await waitFor(()=>q('#ntList .imp-row'),'note review');
    need(qa('#ntList .imp-row').length===2&&/Nota de corretagem/.test($('shTitle').textContent),'note rows');
    need(stored().tx.length===n0,'saved before confirming');
    $('ntGo').click();await tick();$('cfOk').click();await waitFor(()=>!$('sheet').open,'note saved');
    need(stored().tx.length===n0+2,'aportes '+(stored().tx.length-n0));
    const pf=$('portfolio').textContent;need(/Ações/.test(pf)&&/FIIs/.test(pf)&&/PETR4/.test(pf)&&/HGLG11/.test(pf),'portfolio: '+pf.slice(0,200));
    $('impOpenInv').click();await chooseFile('nota.txt',note);await waitFor(()=>q('#ntList .imp-row'),'note review 2');$('ntGo').click();await tick();$('cfOk').click();await waitFor(()=>!$('sheet').open,'note again');
    need(stored().tx.length===n0+2,'duplicated aportes');});
  await step('remove test data',async()=>{$('demoOff').click();await confirmYes();need(!/lançamentos de teste/.test($('demoN').textContent),'still there');});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

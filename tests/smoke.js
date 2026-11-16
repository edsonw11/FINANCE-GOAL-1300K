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
  await step('remove test data',async()=>{$('demoOff').click();await confirmYes();need(!/lançamentos de teste/.test($('demoN').textContent),'still there');});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

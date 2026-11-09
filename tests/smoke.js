/**
 * tests/smoke.js
 * Responsibility: smoke scenario using only the DOM (no access to internal variables).
 * Runs after app.js and writes the result to <html data-smoke="...">.
 */
(function(){
  const errs=[],out=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
  window.confirm=()=>true;
  const $=id=>document.getElementById(id);
  const step=(n,f)=>{try{f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  step('generate test data',()=>$('demoOn').click());
  step('summary has chart and analysis',()=>{need($('chTrend').innerHTML.length>500,'chTrend vazio');need($('trendIns').innerHTML.length>500,'trendIns vazio');});
  step('open category pop-up',()=>{const r=document.querySelector('#trendIns [data-cm]');need(r,'no row');r.click();need($('catMDlg').open,'pop-up closed');need($('cmBody').innerHTML.includes('Total'),'no total');$('cmClose').click();});
  step('tabs',()=>document.querySelectorAll('nav button').forEach(b=>b.click()));
  step('enter card purchase',()=>{document.querySelector('input[name=tp][value=despesa]').click();
    $('fVal').value='50,00';$('fCat').value='Mercado';$('fFonte').value='cartao';$('fSave').click();});
  step('pay invoice (partial)',()=>{const r=document.querySelector('input[name=tp][value=fatura]');r.checked=true;r.dispatchEvent(new Event('change'));
    need($('payBox').innerHTML.includes('Qual fatura'),'no invoice list');
    if(!document.querySelector('input[name=payM][value=part]'))document.querySelector('[data-pa]').click();
    document.querySelector('input[name=payM][value=part]').click();$('payVal').value='10,00';$('payGo').click();});
  step('cancel payment',()=>{const b=document.querySelector('[data-cp]');need(b,'no payment');b.click();});
  step('disable category',()=>{const c=document.querySelector('[data-co]');need(c,'no toggle');c.checked=false;c.dispatchEvent(new Event('change'));});
  step('remove test data',()=>$('demoOff').click());
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

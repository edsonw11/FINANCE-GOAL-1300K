/**
 * tests/shot.js
 * Responsibility: test helper for screenshots. Reads instructions from location.hash
 * (demo, card=<value>, tab=<id>, click=<css selector>, scroll=<px>, notoast). card enters a
 * credit-card purchase of that value today (so the invoice screens have something to show) and applies them after the app boots.
 * Only the DOM is used (the app modules expose no globals); for another month use
 * click=[data-mv="-1"].
 */
(function(){
  const p=new URLSearchParams(location.hash.slice(1));
  window.confirm=()=>true;
  // notoast: hides the toast, whose timing makes screenshots differ (visual comparisons)
  if(p.has('notoast'))document.head.insertAdjacentHTML('beforeend','<style>#toast{display:none!important}</style>');
  const demoN=document.getElementById('demoN');
  if(p.has('demo')&&!/lançamentos de teste/.test(demoN?demoN.textContent:''))document.getElementById('demoOn').click();
  if(p.get('card')){const $=id=>document.getElementById(id);$('fab').click();
    const r=document.querySelector('input[name=tp][value=despesa]');r.checked=true;r.dispatchEvent(new Event('change'));
    $('fVal').value='R$ '+p.get('card');$('fCat').value='Mercado';$('fDesc').value='Compra teste';$('fFonte').value='cartao';
    $('fDate').value=new Date().toLocaleDateString('sv');$('fSave').click();}
  const tab=p.get('tab');if(tab){const b=document.querySelector(`nav [data-t="${tab}"]`);if(b)b.click();}
  (p.getAll('click')||[]).forEach(sel=>{const el=document.querySelector(sel);if(el)el.click();else (window.__errs=window.__errs||[]).push('no '+sel);});
  const sc=+p.get('scroll')||0;if(sc)window.scrollTo(0,sc);
  // overflow report: elements wider than the viewport
  const W=document.documentElement.clientWidth,bad=[];
  document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect();if(r.width&&r.right>W+1&&getComputedStyle(el).position!=='fixed'){const id=el.id?'#'+el.id:el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:el.tagName;bad.push(id+':'+Math.round(r.right));}});
  setTimeout(()=>document.documentElement.setAttribute('data-overflow',[document.documentElement.scrollWidth+'/'+W].concat(bad.slice(0,15)).join(' ')+' ERRS:'+(window.__errs||[]).join(' ; ')),0);
})();

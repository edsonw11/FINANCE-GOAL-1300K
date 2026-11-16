/**
 * tests/mobile-check.js
 * Responsibility: checks for horizontal overflow at real phone widths. Each width is an iframe
 * (its own viewport, so the media queries apply). In every iframe: test data, each tab,
 * each summary card detail, a record detail and the form in the sheet.
 * Result in <html data-mobile="...">. Needs the project served over http.
 */
(async function(){
  const widths=[320,360,375,390,430,768],out=[];
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(const w of widths){
    const f=document.createElement('iframe');f.style.cssText=`width:${w}px;height:800px;border:0`;
    f.src='.mobile.html?'+w;document.body.appendChild(f);
    await new Promise(r=>f.onload=r);await wait(150);
    const W=f.contentWindow,D=f.contentDocument,bad=[];
    const check=where=>{const vw=D.documentElement.clientWidth;
      if(D.documentElement.scrollWidth>vw+1){const els=[...D.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>vw+1&&e.parentElement.getBoundingClientRect().right<=vw+1).slice(0,4).map(e=>e.tagName+(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ')[0]+'<'+(e.parentElement.id||e.parentElement.className)+'>'+Math.round(e.getBoundingClientRect().right));
        bad.push(where+': page '+D.documentElement.scrollWidth+'>'+vw+' '+els.join(','));}
      const sh=D.getElementById('sheet');
      if(sh.open){const b=D.getElementById('shBody');if(b.scrollWidth>b.clientWidth+1)bad.push(where+': sheet '+b.scrollWidth+'>'+b.clientWidth);
        if(sh.getBoundingClientRect().right>vw+1)bad.push(where+': sheet box '+Math.round(sh.getBoundingClientRect().right));}};
    try{
      D.getElementById('demoOn').click();await wait(50);
      D.querySelector('#t-resumo [data-mv="-1"]').click();await wait(20); // previous month, which has closed data
      for(const t of ['resumo','lanc','cartao','meta','cad','cfg']){D.querySelector('#nav [data-t='+t+']').click();await wait(30);check('tab '+t);
        // every control a finger must hit is at least 44px (invisible/hidden ones are skipped)
        D.documentElement.clientWidth<=430&&[...D.querySelectorAll('#t-'+t+' button,#t-'+t+' [role=button],#t-'+t+' select,#t-'+t+' summary,#t-'+t+' input:not([type=hidden]):not([hidden])')]
          .filter(e=>e.offsetParent!==null&&!e.closest('[hidden]')).forEach(e=>{const r=e.getBoundingClientRect();
            if(r.width&&(r.height<43.5||r.width<43.5)&&!/^(INPUT)$/.test(e.tagName+(e.type==='checkbox'?'':'x')))bad.push('small target on '+t+': '+(e.id||e.className||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height));});
        // a help note inside a form row must use the full row, not a narrow sliver
        D.documentElement.clientWidth<=430&&D.querySelectorAll('#t-'+t+' .f-note').forEach(n=>{const row=n.parentElement.getBoundingClientRect().width;if(n.getBoundingClientRect().width<row*0.6)bad.push('narrow note on '+t+': '+Math.round(n.getBoundingClientRect().width)+'/'+Math.round(row));});
        // charts: drawn at (about) real size, so the text is not shrunk
        D.querySelectorAll('#t-'+t+' svg[id^=ch][viewBox]').forEach(sv=>{const vb=+sv.getAttribute('viewBox').split(' ')[2],r=sv.getBoundingClientRect().width;
          if(r&&w<=430&&r/vb<0.9)bad.push(t+' chart '+sv.id+' scaled '+(r/vb).toFixed(2));});
        const tb=D.querySelector('#t-'+t+' .scroll');if(tb&&w<=430&&tb.offsetParent&&tb.scrollWidth>tb.clientWidth+1)bad.push(t+' table scrolls '+tb.scrollWidth+'>'+tb.clientWidth);}
      D.querySelector('#nav [data-t=resumo]').click();
      for(const k of D.querySelectorAll('#t-resumo [data-kpi]')){k.click();await wait(20);check('kpi '+k.dataset.kpi);D.getElementById('shClose').click();}
      const c=D.querySelector('#cats [data-go=cat]');c.click();await wait(20);check('category');
      const d=D.querySelector('#shBody details.cm');d.open=true;await wait(20);check('category open');
      D.querySelector('#shBody [data-tx]').click();await wait(20);check('tx detail');
      D.querySelector('#shFoot [data-act=edit]').click();await wait(30);check('tx edit form');D.getElementById('shClose').click();
      D.getElementById('fab').click();await wait(30);check('new form');D.getElementById('shClose').click();
      // import: pick step, review with an open editor, result; quick entry field
      D.getElementById('impOpen').click();await wait(30);check('import pick');
      const dt=new W.DataTransfer();dt.items.add(new W.File(['Data;Descrição;Valor\n03/09/2026;PADARIA COM UM NOME BEM LONGO PARA TESTAR A QUEBRA DE LINHA NO CELULAR;-13,37\n04/09/2026;SALARIO;4.321,09\n05/09/2026;PAGAMENTO FATURA CARTAO;-900,00\n06/09/2026;LOJA PARC 02/03;-77,77\n'],'x.csv'));
      const inp=D.getElementById('impFile');inp.files=dt.files;inp.dispatchEvent(new W.Event('change'));
      for(let i=0;i<60&&!D.getElementById('impSend');i++)await wait(30);check('import file chosen');D.getElementById('impSend').click();
      for(let i=0;i<60&&!D.querySelector('#impList .imp-row');i++)await wait(30);
      check('import review');D.querySelector('#impList [data-imp-open]').click();await wait(30);check('import editor');
      D.getElementById('shClose').click();await wait(20);
      D.getElementById('qeText').value='gastei 85,90 no mercado hoje';D.getElementById('qeForm').dispatchEvent(new W.Event('submit',{cancelable:true}));await wait(30);check('quick entry form');D.getElementById('shClose').click();
      const touch=[...D.querySelectorAll('#bnav button,#fab,.mnav button')].filter(b=>b.offsetParent!==null||b.id==='fab').filter(b=>{const r=b.getBoundingClientRect();return r.width&&(r.width<43.5||r.height<43.5);});
      if(w<=430&&touch.length)bad.push('small targets: '+touch.map(b=>b.textContent.trim()||b.id).join(','));
    }catch(e){bad.push('ERR '+e.message);}
    out.push(w+'px '+(bad.length?'FAIL '+bad.slice(0,6).join(' ; '):'ok'));
    f.remove();
  }
  document.documentElement.setAttribute('data-mobile',out.join(' | '));
})();

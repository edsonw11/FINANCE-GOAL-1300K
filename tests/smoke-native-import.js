/**
 * tests/smoke-native-import.js
 * Responsibility: every import format (CSV, OFX bank and card, digital PDF: statement, custody, card invoice) read inside the Android build, i.e. under its own
 * Content-Security-Policy and with a scripted Capacitor. The page is mobile/www/index.html. It exists because that policy once blocked the PDF reader
 * ("Não consegui carregar o leitor de PDF") and no test opened a file under it.
 */
(async function(){
  const errs=[],out=[],violations=[];
  window.addEventListener('error',e=>errs.push('ERR '+e.message));
  window.addEventListener('securitypolicyviolation',e=>violations.push(e.violatedDirective+' '+e.blockedURI));
  const $=id=>document.getElementById(id),q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const step=async(n,f)=>{try{await f();out.push('ok '+n);}catch(e){out.push('FAIL '+n+': '+e.message);}document.documentElement.setAttribute('data-smoke',out.concat(errs,['…running']).join(' | '));};
  const need=(c,m)=>{if(!c)throw new Error(m);};
  // headless Chrome runs with virtual time: a Worker (pdf.js) needs a real (failing) image load to let time pass
  const realTick=()=>new Promise(r=>{const i=new Image();i.onload=i.onerror=()=>r();i.src='tick-'+Math.random()+'.png';});
  const waitFor=async(f,what,max)=>{for(let i=0;i<(max||600);i++){if(f())return;await Promise.all([realTick(),new Promise(r=>setTimeout(r,5))]);}throw new Error('timeout: '+what);};
  const stored=()=>JSON.parse(localStorage.getItem('metaapp.v2'));
  // the error line only exists while the file chooser is on screen; the review screen replaces it
  const hasErr=()=>!!$('impErr')&&!$('impErr').hidden,errText=()=>$('impErr')?$('impErr').textContent:'';
  const b64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
  const pick=async(name,content,type)=>{const dt=new DataTransfer();dt.items.add(new File([content],name,{type}));const i=$('impFile');i.files=dt.files;i.dispatchEvent(new Event('change'));
    if($('confirmDlg').open&&hasErr())return;await waitFor(()=>$('impSend')||q('#impList .imp-row')||hasErr(),'file '+name,200);if($('impSend'))$('impSend').click();};
  const reviewed=async(name,rows)=>{await waitFor(()=>q('#impList .imp-row')||hasErr(),'review of '+name,400);
    need(!hasErr(),name+': '+errText());need(qa('#impList .imp-row').length===rows,name+': '+qa('#impList .imp-row').length+' rows, expected '+rows);};
  const confirmImport=async()=>{$('impGo').click();await waitFor(()=>$('confirmDlg').open,'confirmation');$('cfOk').click();await waitFor(()=>q('.imp-ok'),'result');$('impDone').click();};
  const open=()=>{if(!$('sheet').open)$('impOpen').click();};
  await new Promise(r=>setTimeout(r,500));
  q('#bnav [data-t=lanc]').click();

  await step('CSV: read, shown for review, saved with the file dates',async()=>{const n0=stored().tx.length;open();await pick('sample-statement.csv',window.IMPORT_SAMPLES.csv,'text/csv');await reviewed('csv',3);
    await confirmImport();const t=stored().tx.slice(n0);need(t.length===3,'saved '+t.length);need(t.some(x=>x.date==='2026-11-04'&&x.type==='receita'&&x.value===4321.09),'salary');});
  await step('OFX (bank): read with signs and dates, saved',async()=>{const n0=stored().tx.length;open();await pick('sample-bank.ofx',window.IMPORT_SAMPLES.ofxBank,'application/x-ofx');await reviewed('ofx',3);
    await confirmImport();const t=stored().tx.slice(n0);need(t.length===3,'saved '+t.length);need(t.some(x=>x.date==='2026-11-06'&&x.type==='receita'&&x.value===5000),'income');need(t.some(x=>x.date==='2026-11-05'&&x.type==='despesa'&&x.value===12.5),'expense');});
  await step('OFX (card): entries become card expenses',async()=>{const n0=stored().tx.length;open();await pick('sample-card.ofx',window.IMPORT_SAMPLES.ofxCard,'application/x-ofx');await reviewed('ofx card',2);
    await confirmImport();const t=stored().tx.slice(n0);need(t.length===2&&t.every(x=>x.fonte==='cartao'&&x.type==='despesa'),'card expenses: '+JSON.stringify(t.map(x=>[x.desc,x.fonte])));});
  await step('PDF (bank statement): the reader loads under the policy and the entries are read',async()=>{const n0=stored().tx.length;open();await pick('extrato.pdf',b64(window.PDF_FIXTURE.bank),'application/pdf');await reviewed('pdf statement',4);
    await confirmImport();need(stored().tx.length===n0+4,'saved '+(stored().tx.length-n0));});
  await step('PDF (card invoice): becomes card expenses',async()=>{const n0=stored().tx.length;open();await pick('fatura.pdf',b64(window.PDF_FIXTURE.card),'application/pdf');await reviewed('pdf card',3);
    await confirmImport();need(stored().tx.length===n0+2,'saved '+(stored().tx.length-n0));});
  await step('PDF (custody statement): opens the custody screen, no transaction is created',async()=>{const n0=stored().tx.length;open();await pick('custodia.pdf',b64(window.PDF_FIXTURE.custody),'application/pdf');
    await waitFor(()=>$('cuAcc')||hasErr(),'custody screen',400);need(!hasErr(),errText());need($('cuAcc'),'no custody screen');need(stored().tx.length===n0,'a transaction was created');if($('sheet').open)$('shClose').click();});
  await step('a file that is not a PDF gets the "cannot open" message, not the "cannot load the reader" one',async()=>{open();await pick('quebrado.pdf','this is not a pdf','application/pdf');
    await waitFor(()=>hasErr(),'error',400);need(/Não consegui abrir este PDF/.test(errText()),'message: '+errText());if($('confirmDlg').open)$('cfOk').click();if($('sheet').open)$('shClose').click();});
  await step('a PDF with a password says so (and asks for a version without one), not "cannot open"',async()=>{open();await pick('protegido.pdf',b64(window.PDF_FIXTURE.locked),'application/pdf');
    await waitFor(()=>hasErr(),'error',400);need(/Este PDF tem senha/.test(errText()),'message: '+errText());if($('confirmDlg').open)$('cfOk').click();if($('sheet').open)$('shClose').click();});
  await step('no Content-Security-Policy violation while importing',()=>{need(violations.length===0,violations.join(' || '));});
  document.documentElement.setAttribute('data-smoke',out.concat(errs).join(' | '));
})();

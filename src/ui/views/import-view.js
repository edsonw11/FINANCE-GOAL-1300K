/**
 * ui/views/import-view.js
 * Responsibility: the "Importar" panel (inside the app's single sheet) and its steps: choose the file
 * (button, drag and drop), map the CSV columns when needed, review, result. Only connects the pieces:
 * reading is in import-load.js, review in import-review.js, saving in import-confirm.js.
 * Accepted formats come from the domain, so the screen never promises a format that is not read.
 */
import { $ } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { supportedText } from '../../domain/import-reader.js';
import { Sheet } from '../components/sheet.js';
import { goTab } from '../navigation.js';
import { askConfirm } from '../components/confirm.js';
import { bindNote, noteHtml } from './import-note-view.js';
import { bindCustody, custodyHtml } from './import-custody-view.js';
import { esc } from '../../core/dom.js';
import { importState, endSession, trace } from './import-session.js';
import { loadImportFile, rereadSession } from './import-load.js';
import { bindReview, footerCounts, reviewHtml } from './import-review.js';
import { confirmAndCommit } from './import-confirm.js';
import { mappingHtml, readMapping } from './import-mapping.js';
import { resultHtml } from './import-result.js';
const pickHtml=(err,file)=>`<div class="imp-pick">
  <p class="help">${t('imp.view.intro')}</p>
  <label class="imp-drop" id="impDrop" for="impFile">${file?`<b>📄 ${esc(file.name)}</b><span class="mut">${t('imp.view.picked',{kb:Math.max(1,Math.round(file.size/1024))})}</span>`:`<b>${t('imp.view.choose')}</b><span class="mut">${t('imp.view.orDrag')}</span>`}</label>
  <div class="imp-formats"><span class="tag ok">✔ CSV</span><span class="tag ok">✔ OFX</span><span class="tag ok">${t('imp.view.fmtPdf')}</span><span class="tag soon">${t('imp.view.notYet')}</span></div>
  <div class="bd-note imp-err" id="impErr"${err?'':' hidden'}>${err||''}</div>
  ${importState.trace.length?`<details class="imp-how" open><summary>${t('imp.view.techDetails')}</summary><p class="help">${importState.trace.map(esc).join('<br>')}</p></details>`:''}
  <details class="imp-how"><summary>${t('imp.view.howTitle')}</summary><p class="help">${t('imp.view.howBody')}</p></details>
</div>`;
// one handler for "file chosen" and "file dropped"
async function takeFile(file,redraw,opts){
  trace(file?t('imp.view.traceReceived',{name:file.name,size:file.size,type:file.type||'?'}):t('imp.view.traceNone'));
  if(!file){redraw(t('imp.view.noFile'));return;}
  const busy=$('impDrop');if(busy){busy.classList.add('busy');busy.querySelector('b').textContent=t('imp.view.reading',{name:file.name||t('imp.view.theFile'),kb:Math.max(1,Math.round(file.size/1024))});}
  let r;
  try{r=await loadImportFile(file,opts);}catch(e){redraw(t('imp.view.readError',{message:e&&e.message||e}));return;}
  trace(r.error?t('imp.view.traceDoneError',{keys:Object.keys(r).join(','),error:r.error}):t('imp.view.traceDone',{keys:Object.keys(r).join(',')}));
  if(r.cancelled){redraw(t('imp.view.closedWhileReading'));return;}
  if(r.error){redraw(r.error,r.sample);return;}
  trace(t('imp.view.traceOpened'));
  redraw();
}
// pop-up with the reason, so a failure is never silent
function showError(reason,file,sample){
  trace(t('imp.view.traceError',{reason}));
  askConfirm({title:t('imp.view.errorTitle'),html:(file?`<div><b>${esc(file.name)}</b></div>`:'')+`<div>${esc(reason)}</div>`+(sample?`<details class="imp-how"><summary>${t('imp.view.sampleTitle')}</summary><pre class="imp-sample">${esc(sample)}</pre></details>`:''),ok:t('imp.view.understood')});
}
function importView(ctx){
  const opts=ctx==='invest'?{kind:'invest'}:undefined;
  let pickError='',picked=null;
  const choose=f=>{picked=f||null;pickError='';Sheet.refresh();};
  const redraw=(err,sample)=>{pickError=typeof err==='string'?err:'';if(pickError)showError(pickError,picked,sample);Sheet.refresh();};
  return {
    render(body,foot){
      const s=importState.session;body.onclick=body.onchange=body.onkeydown=null;foot.innerHTML='';
      if(!s){body.innerHTML=pickHtml(pickError,picked);bindPick(body,choose);
        if(picked){foot.innerHTML='<button type="button" class="btn pri" id="impSend">'+t('imp.view.send')+'</button>';$('impSend').onclick=()=>{$('impSend').disabled=true;takeFile(picked,redraw,opts);};}return {title:ctx==='invest'?t('imp.view.titleInvest'):t('imp.view.titleTx'),sub:t('imp.view.subPick',{supported:supportedText()})};}
      if(s.phase==='note'){body.innerHTML=noteHtml(s);bindNote(s,body,foot);return {title:t('imp.view.titleNote'),sub:t('imp.view.subReview')};}
      if(s.phase==='custody'){body.innerHTML=custodyHtml(s);bindCustody(s,body,foot);return {title:t('imp.view.titleCustody'),sub:t('imp.view.subCustody')};}
      if(s.phase==='mapping'){
        body.innerHTML=mappingHtml(s.read);
        foot.innerHTML='<button type="button" class="btn" id="impBack">'+t('imp.common.back')+'</button><button type="button" class="btn pri" id="impMapGo">'+t('imp.view.useColumns')+'</button>';
        $('impBack').onclick=()=>{if(s.read.ok){s.phase='review';}else{endSession();}Sheet.refresh();};
        $('impMapGo').onclick=()=>{const m=readMapping(body);if(!m){body.querySelector('.help').textContent=t('imp.view.needColumns');return;}
          rereadSession({mapping:m});Sheet.refresh();};
        return {title:t('imp.view.titleColumns'),sub:s.file&&s.file.name};
      }
      if(s.phase==='result'){
        body.innerHTML=resultHtml(s);
        const left=s.result.items.filter(i=>i.status==='failed').length; // only what failed needs another try
        foot.innerHTML=(left?'<button type="button" class="btn" id="impFix">'+t('imp.view.fixLeft')+'</button>':'')+'<button type="button" class="btn" id="impList2">'+t('imp.view.seeTx')+'</button><button type="button" class="btn pri" id="impDone">'+t('imp.common.done')+'</button>';
        if(left)$('impFix').onclick=()=>{s.phase='review';s.result=null;Sheet.refresh();};
        $('impList2').onclick=()=>{Sheet.close();goTab('lanc');};
        $('impDone').onclick=()=>Sheet.close();
        return {title:t('imp.view.titleDone')};
      }
      body.innerHTML=reviewHtml(s);
      foot.innerHTML='<button type="button" class="btn" id="impCancel">'+t('imp.common.cancel')+'</button><button type="button" class="btn pri" id="impGo"></button>';
      const footer=()=>{const c=footerCounts(s),b=$('impGo');if(!b)return;b.textContent=c.label;b.disabled=!c.count||s.busy;};
      footer();
      $('impCancel').onclick=()=>Sheet.close();
      $('impGo').onclick=async()=>{$('impGo').disabled=true;const ok=await confirmAndCommit();if(ok)Sheet.refresh();else footer();};
      bindReview(body,{redraw:()=>Sheet.refresh(),footer});
      return {title:t('imp.view.titleReview'),sub:t('imp.view.subPreview')};
    },
    leave(){endSession();}};
}
function bindPick(body,choose){
  const drop=body.querySelector('#impDrop');if(!drop)return;
  const over=on=>drop.classList.toggle('over',on);
  drop.addEventListener('dragover',e=>{e.preventDefault();over(true);});
  drop.addEventListener('dragleave',()=>over(false));
  drop.addEventListener('drop',e=>{e.preventDefault();over(false);choose(e.dataTransfer.files[0]);});
  // the file is only picked here; it is read when the user taps "Enviar". The input is not cleared: on some phones that invalidates the file
  $('impFile').onchange=async e=>{
    const input=e.target,f=input.files[0];
    if(!f){choose(null);input.value='';return;}
    // copy the bytes now: a phone may invalidate the File later (and it lets the same file be chosen again)
    try{const buf=await f.arrayBuffer();choose({name:f.name,size:f.size,type:f.type,arrayBuffer:()=>Promise.resolve(buf)});}
    catch(err){choose(null);showError(t('imp.view.phoneDenied',{reason:err&&err.message||err}),f);}
    input.value='';
  };
}
export function openImport(ctx){Sheet.open(importView(ctx));}
export function bindImport(){
  // no accept filter: several phone file pickers grey out valid files when it mixes extensions and types; the type is checked after choosing
  $('impOpen').onclick=()=>openImport();
  $('impOpenInv').onclick=()=>openImport('invest');
}

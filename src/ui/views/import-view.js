/**
 * ui/views/import-view.js
 * Responsibility: the "Importar" panel (inside the app's single sheet) and its steps: choose the file
 * (button, drag and drop), map the CSV columns when needed, review, result. Only connects the pieces:
 * reading is in import-load.js, review in import-review.js, saving in import-confirm.js.
 * Accepted formats come from the domain, so the screen never promises a format that is not read.
 */
import { $ } from '../../core/dom.js';
import { SUPPORTED_TEXT } from '../../domain/import-reader.js';
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
  <p class="help">Envie o extrato do banco ou a fatura do cartão. O app lê o arquivo, mostra o que encontrou e <b>só grava depois que você confirmar</b>.</p>
  <label class="imp-drop" id="impDrop" for="impFile">${file?`<b>📄 ${esc(file.name)}</b><span class="mut">${Math.max(1,Math.round(file.size/1024))} KB · toque em “Enviar” para ler, ou escolha outro arquivo</span>`:'<b>📥 Escolher arquivo</b><span class="mut">ou arraste o arquivo para cá (computador)</span>'}</label>
  <div class="imp-formats"><span class="tag ok">✔ CSV</span><span class="tag ok">✔ OFX</span><span class="tag ok">✔ PDF digital</span><span class="tag soon">Foto, PDF escaneado e Excel: ainda não</span></div>
  <div class="bd-note imp-err" id="impErr"${err?'':' hidden'}>${err||''}</div>
  ${importState.trace.length?`<details class="imp-how" open><summary>Detalhes técnicos</summary><p class="help">${importState.trace.map(esc).join('<br>')}</p></details>`:''}
  <details class="imp-how"><summary>Como pegar o arquivo no banco?</summary><p class="help">No app ou site do banco, abra o extrato ou a fatura e use <b>Exportar</b> ou <b>Baixar</b>, escolhendo <b>OFX</b> ou <b>CSV</b> (os mais precisos). O <b>PDF digital</b> (aquele em que dá para selecionar o texto) também é lido, mas de forma aproximada: confira a prévia. PDF escaneado ou foto ainda não são lidos.</p></details>
</div>`;
// one handler for "file chosen" and "file dropped"
async function takeFile(file,redraw,opts){
  trace(file?'arquivo recebido: '+file.name+' · '+file.size+' bytes · tipo '+(file.type||'?'):'nenhum arquivo recebido');
  if(!file){redraw('O navegador não recebeu o arquivo. Se ele está no Drive ou na nuvem, baixe para o celular (pasta Downloads) e escolha de lá.');return;}
  const busy=$('impDrop');if(busy){busy.classList.add('busy');busy.querySelector('b').textContent='⏳ Lendo '+(file.name||'o arquivo')+' ('+Math.max(1,Math.round(file.size/1024))+' KB)…';}
  let r;
  try{r=await loadImportFile(file,opts);}catch(e){redraw('Erro ao ler o arquivo: '+(e&&e.message||e));return;}
  trace('leitura terminou: '+Object.keys(r).join(',')+(r.error?' · '+r.error:''));
  if(r.cancelled){redraw('A janela foi fechada durante a leitura. Abra Importar e escolha o arquivo de novo.');return;}
  if(r.error){redraw(r.error,r.sample);return;}
  trace('revisão aberta');
  redraw();
}
// pop-up with the reason, so a failure is never silent
function showError(reason,file,sample){
  trace('erro: '+reason);
  askConfirm({title:'Não consegui importar',html:(file?`<div><b>${esc(file.name)}</b></div>`:'')+`<div>${esc(reason)}</div>`+(sample?`<details class="imp-how"><summary>Texto que o app leu do PDF</summary><pre class="imp-sample">${esc(sample)}</pre></details>`:''),ok:'Entendi'});
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
        if(picked){foot.innerHTML='<button type="button" class="btn pri" id="impSend">Enviar e ler o arquivo</button>';$('impSend').onclick=()=>{$('impSend').disabled=true;takeFile(picked,redraw,opts);};}return {title:ctx==='invest'?'Importar investimentos':'Importar lançamentos',sub:SUPPORTED_TEXT+' · revisão antes de gravar'};}
      if(s.phase==='note'){body.innerHTML=noteHtml(s);bindNote(s,body,foot);return {title:'Nota de corretagem',sub:'Revisão antes de gravar'};}
      if(s.phase==='custody'){body.innerHTML=custodyHtml(s);bindCustody(s,body,foot);return {title:'Atualizar saldo',sub:'Extrato de custódia · revisão antes de gravar'};}
      if(s.phase==='mapping'){
        body.innerHTML=mappingHtml(s.read);
        foot.innerHTML='<button type="button" class="btn" id="impBack">Voltar</button><button type="button" class="btn pri" id="impMapGo">Usar estas colunas</button>';
        $('impBack').onclick=()=>{if(s.read.ok){s.phase='review';}else{endSession();}Sheet.refresh();};
        $('impMapGo').onclick=()=>{const m=readMapping(body);if(!m){body.querySelector('.help').textContent='Escolha ao menos a coluna da data e a do valor (ou entradas/saídas).';return;}
          rereadSession({mapping:m});Sheet.refresh();};
        return {title:'Colunas do arquivo',sub:s.file&&s.file.name};
      }
      if(s.phase==='result'){
        body.innerHTML=resultHtml(s);
        const left=s.result.items.filter(i=>i.status==='failed').length; // only what failed needs another try
        foot.innerHTML=(left?'<button type="button" class="btn" id="impFix">Corrigir os que faltaram</button>':'')+'<button type="button" class="btn" id="impList2">Ver lançamentos</button><button type="button" class="btn pri" id="impDone">Concluir</button>';
        if(left)$('impFix').onclick=()=>{s.phase='review';s.result=null;Sheet.refresh();};
        $('impList2').onclick=()=>{Sheet.close();goTab('lanc');};
        $('impDone').onclick=()=>Sheet.close();
        return {title:'Importação concluída'};
      }
      body.innerHTML=reviewHtml(s);
      foot.innerHTML='<button type="button" class="btn" id="impCancel">Cancelar</button><button type="button" class="btn pri" id="impGo"></button>';
      const footer=()=>{const c=footerCounts(s),b=$('impGo');if(!b)return;b.textContent=c.label;b.disabled=!c.count||s.busy;};
      footer();
      $('impCancel').onclick=()=>Sheet.close();
      $('impGo').onclick=async()=>{$('impGo').disabled=true;const ok=await confirmAndCommit();if(ok)Sheet.refresh();else footer();};
      bindReview(body,{redraw:()=>Sheet.refresh(),footer});
      return {title:'Revisar importação',sub:'Prévia: nada gravado ainda'};
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
    catch(err){choose(null);showError('O celular não deixou o app ler o arquivo ('+(err&&err.message||err)+'). Baixe-o para a pasta Downloads e escolha de lá.',f);}
    input.value='';
  };
}
export function openImport(ctx){Sheet.open(importView(ctx));}
export function bindImport(){
  // no accept filter: several phone file pickers grey out valid files when it mixes extensions and types; the type is checked after choosing
  $('impOpen').onclick=()=>openImport();
  $('impOpenInv').onclick=()=>openImport('invest');
}

/**
 * ui/views/import-review.js
 * Responsibility: the review screen of an import: the preview summary (nothing is saved yet), the
 * options of the file, the list of draft cards with their inline editor, and the events that edit,
 * select, remove or add drafts. Updates only the parts that changed so what the user typed stays.
 */
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { formatDateBR, mShort } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { importOverview } from '../../domain/import-draft.js';
import { prepareMoneyInputs } from '../components/money-input.js';
import { datePicker } from '../components/date-input.js';
import { rereadSession } from './import-load.js';
import { addManualDraft, draftById, importState, patchDraft, removeDraft, setAllSelected } from './import-session.js';
import { rowCard, rowEditor } from './import-rows.js';
const catNames=type=>((S.cats||{})[type]||[]).filter(c=>!c.off).map(c=>c.name);
const catsFor=d=>catNames(d.type==='receita'?'receita':'despesa');
export function summaryHtml(s){
  const ov=importOverview(s.drafts),r=s.read,sel=ov.selected,dup=ov.confirmedDup+ov.possibleDup;
  const notes=[];
  if(r.alreadyImported)notes.push(`Este arquivo já foi importado em ${formatDateBR(r.alreadyImported.at||'0000-00-00')} (${r.alreadyImported.count} lançamentos). O que já foi salvo aparece como duplicado e fica desmarcado.`);
  if(r.format==='pdf')notes.push('Leitura de PDF é aproximada: confira data, valor e sinal de cada linha com o documento. Linhas sem data no começo podem ter ficado de fora.');
  if(r.dropped)notes.push(`${r.dropped} linha(s) de saldo ou total foram deixadas de fora: não são lançamentos.`);
  const sk=r.skipped||{},skipped=(sk.noDate||0)+(sk.noValue||0);
  if(skipped)notes.push(`${skipped} linha(s) sem data ou sem valor foram ignoradas.`);
  if(r.unreadable)notes.push(`${r.unreadable} transação(ões) do OFX não puderam ser lidas.`);
  return `<div class="imp-banner">🔎 <b>Prévia:</b> nada foi gravado ainda. Confira, ajuste e só então confirme.</div>
    <div class="imp-file"><b>${esc(r.fileName)}</b> · ${r.format.toUpperCase()} · ${r.kind==='card'?'fatura do cartão':r.kind==='invest'?'extrato de investimento: entradas viram aporte':'extrato da conta'}</div>
    <div class="imp-tiles">
      <div><span>Lidos</span><b>${ov.total}</b></div>
      <div><span>Receitas</span><b class="rec">${ov.incomes}</b><small>${f2(ov.incomeTotal)}</small></div>
      <div><span>Despesas</span><b class="des">${ov.expenses}</b><small>${f2(ov.expenseTotal)}</small></div>
      ${ov.contributions?`<div><span>Aportes</span><b class="apo">${ov.contributions}</b><small>${f2(ov.contributionTotal)}</small></div>`:''}
      ${ov.transfers?`<div><span>Transferências suas</span><b>${ov.transfers}</b><small>${f2(ov.transferTotal)} · não contam</small></div>`:''}
      ${ov.others?`<div><span>Não importáveis</span><b>${ov.others}</b><small>não viram lançamento</small></div>`:''}
      <div class="${ov.review?'warn':''}"><span>Para revisar</span><b>${ov.review}</b></div>
      <div class="${dup?'warn':''}"><span>Duplicados</span><b>${dup}</b>${dup?`<small>${ov.confirmedDup} certos · ${ov.possibleDup} possíveis</small>`:''}</div>
    </div>
    <div class="imp-pick-sum">Selecionados: <b>${sel.count}</b>${sel.count?` · receitas ${f2(sel.income)} · despesas ${f2(sel.expense)} · ${sel.months.map(m=>esc(mShort(m))).join(', ')}`:''}</div>
    ${notes.map(n=>`<div class="imp-note">ℹ️ ${esc(n)}</div>`).join('')}`;
}
const optionsHtml=s=>`<details class="imp-opts-d"><summary>Opções do arquivo: extrato ou fatura, sinais, colunas</summary><div class="imp-opts">
  <label>Este arquivo é<select id="impKind"><option value="bank"${s.opts.kind!=='card'?' selected':''}>Extrato da conta</option><option value="card"${s.opts.kind==='card'?' selected':''}>Fatura do cartão</option></select></label>
  <label class="check-opt"><input type="checkbox" id="impInvert"${s.opts.invert?' checked':''}> Inverter sinais (se receitas e despesas vieram trocadas)</label>
  ${s.read.format==='csv'?'<button type="button" class="link-btn" data-imp-cols>Ajustar colunas</button>':''}
</div></details>`;
const toolbarHtml='<div class="imp-tools"><button type="button" class="btn sm" data-imp-all="1">Marcar todos</button><button type="button" class="btn sm" data-imp-all="0">Desmarcar todos</button><button type="button" class="btn sm" data-imp-add>+ Adicionar lançamento</button></div>';
const itemHtml=(s,d)=>`<div class="imp-item" data-imp-item="${d.id}">${rowCard(d)}${s.openId===d.id?rowEditor(d,catsFor(d)):''}</div>`;
const listHtml=s=>s.drafts.length?s.drafts.map(d=>itemHtml(s,d)).join(''):'<div class="empty">Nada para importar. Use “Adicionar lançamento” se algo não foi identificado.</div>';
export function reviewHtml(s){
  return `<div id="impSum">${summaryHtml(s)}</div>${optionsHtml(s)}${toolbarHtml}<div class="imp-list" id="impList">${listHtml(s)}</div>`;
}
export function footerCounts(s){
  const ov=importOverview(s.drafts),c=ov.selected.count,t=ov.transfers;
  const label=c?`Importar ${c} lançamento${c>1?'s':''}${t?' + '+t+' transf.':''}`:t?`Guardar ${t} transferência${t>1?'s':''}`:'Nada selecionado';
  return {count:c+t,label};
}
// binds the events once per draw (assigning on* replaces the previous handlers)
export function bindReview(body,ctx){
  const s=importState.session,item=id=>body.querySelector(`[data-imp-item="${id}"]`);
  const refreshSummary=()=>{$('impSum').innerHTML=summaryHtml(s);ctx.footer();};
  const redrawItem=id=>{const el=item(id),d=draftById(id);if(el&&d){el.outerHTML=itemHtml(s,d);}openEditorTools(item(id));};
  const redrawCard=id=>{const row=body.querySelector(`[data-imp-row="${id}"]`),d=draftById(id);if(row&&d)row.outerHTML=rowCard(d);};
  function openEditorTools(el){
    if(!el)return;prepareMoneyInputs(el);
    el.querySelectorAll('input[type=date]').forEach(i=>datePicker(i));
  }
  const open=id=>{const prev=s.openId;s.openId=s.openId===id?null:id;if(prev)redrawItem(prev);if(s.openId)redrawItem(s.openId);
    if(s.openId){const e=item(s.openId);if(e&&e.scrollIntoView)e.scrollIntoView({block:'nearest'});}};
  body.onclick=e=>{
    const t=e.target,row=t.closest('[data-imp-item]'),id=row&&row.dataset.impItem;
    // before the card's own click (the button sits inside the card, which opens the editor)
    const fix=t.closest('[data-imp-pairfix]');
    if(fix&&id){patchDraft(id,fix.dataset.impPairfix==='1'?{type:'transferencia',fixPair:true}:{fixPair:false});redrawItem(id);refreshSummary();return;}
    if(t.closest('[data-imp-open]')&&id){if(!t.closest('.imp-chk'))open(id);return;}
    if(t.closest('[data-imp-close]')){open(id);return;}
    if(t.closest('[data-imp-del]')){removeDraft(id);row.remove();refreshSummary();return;}
    const all=t.closest('[data-imp-all]');
    if(all){setAllSelected(all.dataset.impAll==='1');s.drafts.forEach(d=>redrawCard(d.id));refreshSummary();return;}
    if(t.closest('[data-imp-add]')){const d=addManualDraft();$('impList').insertAdjacentHTML('afterbegin',itemHtml(s,d));openEditorTools(item(d.id));refreshSummary();return;}
    if(t.closest('[data-imp-cols]')){s.phase='mapping';ctx.redraw();}
  };
  body.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.imp-main')){e.preventDefault();e.target.click();}};
  body.onchange=e=>{
    const t=e.target,row=t.closest('[data-imp-item]'),id=row&&row.dataset.impItem;
    if(t.id==='impKind'){rereadSession({kind:t.value});ctx.redraw();return;}
    if(t.id==='impInvert'){rereadSession({invert:t.checked});ctx.redraw();return;}
    if(!id)return;
    if(t.matches('[data-imp-sel]')){patchDraft(id,{selected:t.checked});redrawCard(id);refreshSummary();return;}
    const f=t.dataset.f;if(!f)return;
    patchDraft(id,{[f]:f==='createRest'?t.checked:t.value});
    if(f==='type'||f==='createRest')redrawItem(id);else redrawCard(id);
    refreshSummary();
  };
}

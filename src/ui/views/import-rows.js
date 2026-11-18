/**
 * ui/views/import-rows.js
 * Responsibility: the HTML of one draft in the review list: the compact card (date, description,
 * value, type, category, where the money goes, why it needs attention) and its inline editor (with
 * the parts when the value is divided across categories).
 * Pure text builders: no events and no state.
 */
import { esc } from '../../core/dom.js';
import { f2, m2 } from '../../core/format.js';
import { addMonths, formatDateBR, mOf, mShort } from '../../core/dates.js';
import { FLAG_TEXT, IMPORT_TYPE, OWN_TRANSFER_TEXT, REASON_TEXT } from '../../domain/import-classify.js';
import { PAIR_KIND, pairText } from '../../domain/transfers.js';
import { active, accName } from '../../domain/accounts.js';
import { NEW_ACCOUNT } from '../../domain/import-account.js';
import { svg } from '../icons.js';
import { canSplit, splitParts, splitRest } from '../../domain/import-split.js';
import { draftProblems, invoiceMonth, isSaveable, needsReview, targetMonth } from '../../domain/import-draft.js';
const IMPORT_TYPE_LABEL={despesa:'Despesa',receita:'Receita',aporte:'Aporte',transferencia:'🔁 Transferência minha',ignorar:'Não importar'};
const IMPORT_SOURCE_LABEL={caixa:'Conta / Pix / débito',cartao:'Cartão de crédito',beneficio:'VR/VA'};
const sourceOptions=d=>(d.type===IMPORT_TYPE.income?['caixa','beneficio']:['caixa','cartao','beneficio'])
  .map(v=>`<option value="${v}"${d.fonte===v?' selected':''}>${IMPORT_SOURCE_LABEL[v]}</option>`).join('');
const typeOptions=d=>['despesa','receita','aporte','transferencia','ignorar'].map(v=>`<option value="${v}"${d.type===v?' selected':''}>${IMPORT_TYPE_LABEL[v]}</option>`).join('');
function notes(d){
  const n=[];
  if(d.dup)n.push(`<div class="imp-note ${d.dup.level==='confirmed'?'dup-c':'dup-p'}">${d.dup.level==='confirmed'?'🔁':'👀'} ${esc(d.dup.text)}</div>`);
  if(d.type===IMPORT_TYPE.ignore&&d.reason)n.push(`<div class="imp-note">${esc(REASON_TEXT[d.reason]||'')}</div>`);
  if(d.type===IMPORT_TYPE.ownTransfer)n.push(`<div class="imp-note">🔁 ${esc(OWN_TRANSFER_TEXT)}</div>`);
  if(d.pair)n.push(pairNote(d));
  d.flags.filter(f=>f!=='transfer-pair').forEach(f=>n.push(`<div class="imp-note warn-n">⚠️ ${esc(FLAG_TEXT[f]||f)}</div>`));
  if(d.installment)n.push(`<div class="imp-note">🧾 Parcela ${d.installment.n}/${d.installment.of}${d.createRest&&d.installment.n<d.installment.of?' · vai criar as parcelas seguintes':''}</div>`);
  const p=draftProblems(d);
  if(isSaveable(d)&&p.length)n.push(`<div class="imp-note bad-n">⛔ ${esc(p.join(' · '))}: corrija para importar</div>`);
  return n.join('');
}
// the other side of a transfer: already kept (nothing to do) or saved as income/expense (offer to fix both)
function pairNote(d){
  const p=d.pair,what=p.type==='despesa'?'despesa':'receita';
  if(p.kind===PAIR_KIND.transfer)return `<div class="imp-note pair-n">🔗 ${esc(pairText(p))}: reconhecida como transferência entre suas contas.</div>`;
  if(d.type===IMPORT_TYPE.ownTransfer&&d.fixPair)return `<div class="imp-note pair-n">🔗 ${esc(pairText(p))} (salvo como ${what}): ao importar, ele também vira transferência. <button type="button" class="link-btn" data-imp-pairfix="0">Desfazer</button></div>`;
  return `<div class="imp-note warn-n pair-n">🔗 ${esc(pairText(p))}, salvo como ${what} (${f2(p.value)}). Se for dinheiro entre suas contas, as duas não contam como receita nem despesa.
    <button type="button" class="btn sm" data-imp-pairfix="1">🔁 É transferência minha: corrigir as duas</button></div>`;
}
// compact card (what the user scans)
export function rowCard(d){
  const sign=d.type===IMPORT_TYPE.income?'+':d.type===IMPORT_TYPE.expense?'−':'',tone=d.type===IMPORT_TYPE.income?'rec':d.type===IMPORT_TYPE.expense?'des':d.type===IMPORT_TYPE.contribution?'apo':'mut';
  const dirTag=d.type===IMPORT_TYPE.ownTransfer?(d.flow==='in'?'<span class="mut">entrou</span>':'<span class="mut">saiu</span>'):'';
  const inv=invoiceMonth(d),month=targetMonth(d);
  const isApo=d.type===IMPORT_TYPE.contribution;
  const where=!isSaveable(d)?'':isApo?(d.acc===NEW_ACCOUNT?((d.newAcc||'').trim()?'📈 ➕ '+esc(d.newAcc.trim())+' (conta nova)':'<span class="warn-c">📈 dê um nome à conta nova</span>'):d.acc?'📈 '+esc(accName(d.acc)):'<span class="warn-c">📈 escolha o investimento</span>'):d.fonte==='cartao'?'💳 Cartão'+(inv?' · fatura de '+mShort(inv):''):d.fonte==='beneficio'?'🍴 VR/VA':'🏦 Conta';
  const cat=!isSaveable(d)||isApo?'':d.cat?'🏷️ '+esc(d.cat):'<span class="warn-c">🏷️ sem categoria</span>';
  const parts=splitParts(d).length,catTxt=cat&&parts?cat+' + '+parts+(parts>1?' partes':' parte'):cat;
  const bad=isSaveable(d)&&(needsReview(d)||draftProblems(d).length);
  return `<div class="imp-row${d.selected?' sel':''}${!isSaveable(d)?' ign':''}${d.dup?' dup':''}${bad?' rev':''}" data-imp-row="${d.id}">
    <label class="imp-chk" aria-label="Importar este lançamento"><input type="checkbox" data-imp-sel${d.selected?' checked':''}${isSaveable(d)?'':' disabled'}></label>
    <div class="imp-main" data-imp-open role="button" tabindex="0">
      <div class="imp-top"><span class="imp-date">${d.date?formatDateBR(d.date).slice(0,5):'--/--'}</span><span class="imp-desc">${esc(d.desc||'(sem descrição)')}</span><b class="imp-val ${tone}">${d.value?sign+' '+f2(d.value):'—'}</b></div>
      <div class="imp-meta"><span class="tag ${d.type==='ignorar'||d.type==='transferencia'?'':d.type}">${IMPORT_TYPE_LABEL[d.type]}</span>${catTxt?'<span>'+catTxt+'</span>':''}${where?'<span>'+where+'</span>':''}${dirTag}${month&&isSaveable(d)?'<span class="mut">conta em '+mShort(month)+'</span>':''}</div>
      ${notes(d)}
    </div>
    <button type="button" class="btn sm" data-imp-open aria-label="Editar">${bad?'Revisar':'Editar'}</button>
  </div>`;
}
// rest of the value that stays in the main category, under the parts
export function splitRestHtml(d){
  const r=splitRest(d);
  return `Resto em <b>${esc(d.cat||'categoria principal')}</b>: <b class="${r<0?'neg':''}">${f2(r)}</b>${r<0?' · as partes passam do valor':''}`;
}
// the value divided across categories: one line per extra part, the rest stays in the main category
function splitHtml(d){
  const rows=(d.splits||[]).map((p,i)=>`<div class="imp-split-row">
    <input data-sp-cat="${i}" list="impCats" value="${esc(p.cat)}" placeholder="Categoria da parte (ex.: Saúde)" aria-label="Categoria da parte ${i+1}">
    <input data-money data-sp-val="${i}" value="${p.value?m2(p.value):''}" placeholder="R$ 0,00" aria-label="Valor da parte ${i+1}">
    <button type="button" class="btn sm dng" data-sp-del="${i}">remover</button></div>`).join('');
  return `<div class="imp-split">${rows}${rows?`<div class="imp-split-sum" data-sp-sum>${splitRestHtml(d)}</div>`:''}
    <button type="button" class="btn sm ico-btn" data-sp-add>${svg(rows?'plus':'pie')}${rows?'Adicionar outra parte':'Dividir em categorias'}</button></div>`;
}
// editor shown under the card when it is open
export function rowEditor(d,catNames){
  const rest=d.installment&&d.installment.n<d.installment.of?d.installment.of-d.installment.n:0;
  const firstEnd=rest&&d.date?mShort(mOf(addMonths(d.date,1)))+' a '+mShort(mOf(addMonths(d.date,rest))):'';
  return `<div class="imp-edit" data-imp-edit="${d.id}">
    <div class="formgrid imp-fields">
      <div><label>Data</label><input type="date" data-f="date" value="${esc(d.date)}"></div>
      <div><label>Valor</label><input data-money data-f="value" value="${d.value?m2(d.value):''}" placeholder="R$ 0,00"></div>
      <div class="span-all"><label>Descrição</label><input data-f="desc" value="${esc(d.desc)}" placeholder="Estabelecimento ou descrição"></div>
      <div><label>Tipo</label><select data-f="type">${typeOptions(d)}</select></div>
      ${d.type===IMPORT_TYPE.contribution?`<div class="span-all"><label>Investimento de destino</label><select data-f="acc"><option value="">Escolha…</option>${active().map(a=>`<option value="${a.id}"${d.acc===a.id?' selected':''}>${esc(a.name)}</option>`).join('')}<option value="${NEW_ACCOUNT}"${d.acc===NEW_ACCOUNT?' selected':''}>➕ Criar conta nova</option></select></div>
      ${d.acc===NEW_ACCOUNT?`<div class="span-all"><label>Nome da conta nova</label><input data-f="newAcc" value="${esc(d.newAcc||'')}" placeholder="Ex.: Itaú Investimentos, Nubank Caixinhas"><div class="help">A conta é criada quando você confirmar a importação.</div></div>`:''}`:''}
      ${isSaveable(d)&&d.type!==IMPORT_TYPE.contribution?`<div><label>Categoria</label><input data-f="cat" list="impCats" value="${esc(d.cat)}" placeholder="Escolha ou digite"><datalist id="impCats">${catNames.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
      <div><label>${d.type===IMPORT_TYPE.income?'Entrou em':'Pago com'}</label><select data-f="fonte">${sourceOptions(d)}</select></div>`:''}
    </div>
    ${canSplit(d)?splitHtml(d):''}
    ${d.type===IMPORT_TYPE.ownTransfer&&d.flow==='out'?`<div class="imp-split"><button type="button" class="btn sm ico-btn" data-sp-spent>${svg('pie')}Esse dinheiro foi gasto: dividir em categorias</button>
      <span class="imp-split-sum">Vira despesa (sai da lista de transferências) e você divide o valor entre categorias.</span></div>`:''}
    ${rest?`<label class="check-opt imp-rest"><input type="checkbox" data-f="createRest"${d.createRest?' checked':''}> Criar também as ${rest} parcelas seguintes (${firstEnd}), uma por mês</label>`:''}
    ${d.raw?`<div class="imp-raw"><span class="mut">Linha ${d.line||''} do arquivo:</span> <code>${esc(d.raw)}</code></div>`:''}
    <div class="imp-edit-foot"><button type="button" class="btn dng sm" data-imp-del>Tirar da importação</button><button type="button" class="btn pri sm" data-imp-close>Concluir</button></div>
  </div>`;
}

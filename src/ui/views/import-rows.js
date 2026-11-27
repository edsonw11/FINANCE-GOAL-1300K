/**
 * ui/views/import-rows.js
 * Responsibility: the HTML of one draft in the review list: the compact card (date, description,
 * value, type, category, where the money goes, why it needs attention) and its inline editor (with
 * the parts when the value is divided across categories).
 * Pure text builders: no events and no state.
 */
import { esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { f2, m2 } from '../../core/format.js';
import { addMonths, formatDateBR, mOf, mShort } from '../../core/dates.js';
import { FLAG_TEXT, IMPORT_TYPE, ownTransferText, REASON_TEXT } from '../../domain/import-classify.js';
import { PAIR_KIND, pairText } from '../../domain/transfers.js';
import { active, accName } from '../../domain/accounts.js';
import { NEW_ACCOUNT } from '../../domain/import-account.js';
import { svg } from '../icons.js';
import { chipsBox } from '../components/category-chips.js';
import { canSplit, splitParts, splitRest } from '../../domain/import-split.js';
import { draftProblems, invoiceMonth, isSaveable, needsReview, targetMonth } from '../../domain/import-draft.js';
const typeLabel=v=>({despesa:()=>t('imp.type.expense'),receita:()=>t('imp.type.income'),aporte:()=>t('imp.type.contribution'),transferencia:()=>t('imp.type.ownTransfer'),ignorar:()=>t('imp.type.ignore')})[v]();
const sourceLabel=v=>({caixa:()=>t('imp.source.cash'),cartao:()=>t('imp.source.card'),beneficio:()=>'VR/VA'})[v]();
const sourceOptions=d=>(d.type===IMPORT_TYPE.income?['caixa','beneficio']:['caixa','cartao','beneficio'])
  .map(v=>`<option value="${v}"${d.fonte===v?' selected':''}>${sourceLabel(v)}</option>`).join('');
const typeOptions=d=>['despesa','receita','aporte','transferencia','ignorar'].map(v=>`<option value="${v}"${d.type===v?' selected':''}>${typeLabel(v)}</option>`).join('');
function notes(d){
  const n=[];
  if(d.dup)n.push(`<div class="imp-note ${d.dup.level==='confirmed'?'dup-c':'dup-p'}">${d.dup.level==='confirmed'?'🔁':'👀'} ${esc(d.dup.text)}</div>`);
  if(d.type===IMPORT_TYPE.ignore&&d.reason)n.push(`<div class="imp-note">${esc(REASON_TEXT[d.reason]||'')}</div>`);
  if(d.type===IMPORT_TYPE.ownTransfer)n.push(`<div class="imp-note">🔁 ${esc(ownTransferText())}</div>`);
  if(d.pair)n.push(pairNote(d));
  d.flags.filter(f=>f!=='transfer-pair').forEach(f=>n.push(`<div class="imp-note warn-n">⚠️ ${esc(FLAG_TEXT[f]||f)}</div>`));
  if(d.installment)n.push(`<div class="imp-note">${d.createRest&&d.installment.n<d.installment.of?t('imp.row.installmentNext',{n:d.installment.n,of:d.installment.of}):t('imp.row.installment',{n:d.installment.n,of:d.installment.of})}</div>`);
  const p=draftProblems(d);
  if(isSaveable(d)&&p.length)n.push(`<div class="imp-note bad-n">${t('imp.review.fixToImport',{problems:esc(p.join(' · '))})}</div>`);
  return n.join('');
}
// the other side of a transfer: already kept (nothing to do) or saved as income/expense (offer to fix both)
function pairNote(d){
  const p=d.pair,what=p.type==='despesa'?t('imp.row.whatExpense'):t('imp.row.whatIncome');
  if(p.kind===PAIR_KIND.transfer)return `<div class="imp-note pair-n">${t('imp.row.pairRecognized',{pair:esc(pairText(p))})}</div>`;
  if(d.type===IMPORT_TYPE.ownTransfer&&d.fixPair)return `<div class="imp-note pair-n">${t('imp.row.pairWillFix',{pair:esc(pairText(p)),what,undo:`<button type="button" class="link-btn" data-imp-pairfix="0">${t('imp.row.undo')}</button>`})}</div>`;
  return `<div class="imp-note warn-n pair-n">${t('imp.row.pairSaved',{pair:esc(pairText(p)),what,value:f2(p.value)})}
    <button type="button" class="btn sm" data-imp-pairfix="1">${t('imp.row.pairFixBtn')}</button></div>`;
}
// compact card (what the user scans)
export function rowCard(d){
  const sign=d.type===IMPORT_TYPE.income?'+':d.type===IMPORT_TYPE.expense?'−':'',tone=d.type===IMPORT_TYPE.income?'rec':d.type===IMPORT_TYPE.expense?'des':d.type===IMPORT_TYPE.contribution?'apo':'mut';
  const dirTag=d.type===IMPORT_TYPE.ownTransfer?(d.flow==='in'?`<span class="mut">${t('imp.row.in')}</span>`:`<span class="mut">${t('imp.row.out')}</span>`):'';
  const inv=invoiceMonth(d),month=targetMonth(d);
  const isApo=d.type===IMPORT_TYPE.contribution;
  const where=!isSaveable(d)?'':isApo?(d.acc===NEW_ACCOUNT?((d.newAcc||'').trim()?t('imp.row.newAccount',{name:esc(d.newAcc.trim())}):`<span class="warn-c">${t('imp.row.nameNewAccount')}</span>`):d.acc?'📈 '+esc(accName(d.acc)):`<span class="warn-c">${t('imp.row.pickInvestment')}</span>`):d.fonte==='cartao'?(inv?t('imp.row.cardInvoice',{month:mShort(inv)}):t('imp.row.card')):d.fonte==='beneficio'?'🍴 VR/VA':t('imp.row.account');
  const cat=!isSaveable(d)||isApo?'':d.cat?'🏷️ '+esc(displayName(d.cat)):`<span class="warn-c">${t('imp.row.noCategory')}</span>`;
  const parts=splitParts(d).length,catTxt=cat&&parts?t('imp.row.catParts',{cat,count:parts}):cat;
  const bad=isSaveable(d)&&(needsReview(d)||draftProblems(d).length);
  return `<div class="imp-row${d.selected?' sel':''}${!isSaveable(d)?' ign':''}${d.dup?' dup':''}${bad?' rev':''}" data-imp-row="${d.id}">
    <label class="imp-chk" aria-label="${t('imp.row.importThis')}"><input type="checkbox" data-imp-sel${d.selected?' checked':''}${isSaveable(d)?'':' disabled'}></label>
    <div class="imp-main" data-imp-open role="button" tabindex="0">
      <div class="imp-top"><span class="imp-date">${d.date?formatDateBR(d.date).slice(0,5):'--/--'}</span><span class="imp-desc">${esc(d.desc||t('imp.common.noDescription'))}</span><b class="imp-val ${tone}">${d.value?sign+' '+f2(d.value):'—'}</b></div>
      <div class="imp-meta"><span class="tag ${d.type==='ignorar'||d.type==='transferencia'?'':d.type}">${typeLabel(d.type)}</span>${catTxt?'<span>'+catTxt+'</span>':''}${where?'<span>'+where+'</span>':''}${dirTag}${month&&isSaveable(d)?`<span class="mut">${t('imp.row.countsIn',{month:mShort(month)})}</span>`:''}</div>
      ${notes(d)}
    </div>
    <button type="button" class="btn sm" data-imp-open aria-label="${t('imp.row.edit')}">${bad?t('imp.row.review'):t('imp.row.edit')}</button>
  </div>`;
}
// rest of the value that stays in the main category, under the parts
export function splitRestHtml(d){
  const r=splitRest(d);
  return t(r<0?'imp.row.restOver':'imp.row.rest',{cat:esc(d.cat?displayName(d.cat):t('imp.row.mainCategory')),value:`<b class="${r<0?'neg':''}">${f2(r)}</b>`});
}
// the value divided across categories: one line per extra part, the rest stays in the main category
function splitHtml(d){
  const rows=(d.splits||[]).map((p,i)=>`<div class="imp-split-row">
    <input data-sp-cat="${i}" list="impCats" value="${esc(displayName(p.cat))}" placeholder="${t('imp.row.partCatHint')}" aria-label="${t('imp.row.partCatLabel',{n:i+1})}">
    <div class="sp-chips">${chipsBox(d.type===IMPORT_TYPE.income?'receita':'despesa',p.cat)}</div>
    <input data-money data-sp-val="${i}" value="${p.value?m2(p.value):''}" placeholder="R$ 0,00" aria-label="${t('imp.row.partValueLabel',{n:i+1})}">
    <button type="button" class="btn sm dng" data-sp-del="${i}">${t('imp.row.remove')}</button></div>`).join('');
  return `<div class="imp-split">${rows}${rows?`<div class="imp-split-sum" data-sp-sum>${splitRestHtml(d)}</div>`:''}
    <button type="button" class="btn sm ico-btn" data-sp-add>${svg(rows?'plus':'pie')}${rows?t('imp.row.addPart'):t('imp.row.splitCategories')}</button></div>`;
}
// editor shown under the card when it is open
export function rowEditor(d,catNames){
  const rest=d.installment&&d.installment.n<d.installment.of?d.installment.of-d.installment.n:0;
  const firstEnd=rest&&d.date?t('imp.row.monthRange',{from:mShort(mOf(addMonths(d.date,1))),to:mShort(mOf(addMonths(d.date,rest)))}):'';
  return `<div class="imp-edit" data-imp-edit="${d.id}">
    <div class="formgrid imp-fields">
      <div><label>${t('imp.common.date')}</label><input type="date" data-f="date" value="${esc(d.date)}"></div>
      <div><label>${t('imp.row.value')}</label><input data-money data-f="value" value="${d.value?m2(d.value):''}" placeholder="R$ 0,00"></div>
      <div class="span-all"><label>${t('imp.common.description')}</label><input data-f="desc" value="${esc(d.desc)}" placeholder="${t('imp.row.descHint')}"></div>
      <div><label>${t('imp.row.type')}</label><select data-f="type">${typeOptions(d)}</select></div>
      ${d.type===IMPORT_TYPE.contribution?`<div class="span-all"><label>${t('imp.row.targetInvestment')}</label><select data-f="acc"><option value="">${t('imp.common.choose')}</option>${active().map(a=>`<option value="${a.id}"${d.acc===a.id?' selected':''}>${esc(a.name)}</option>`).join('')}<option value="${NEW_ACCOUNT}"${d.acc===NEW_ACCOUNT?' selected':''}>${t('imp.common.newAccountOption')}</option></select></div>
      ${d.acc===NEW_ACCOUNT?`<div class="span-all"><label>${t('imp.common.newAccountName')}</label><input data-f="newAcc" value="${esc(d.newAcc||'')}" placeholder="${t('imp.row.newAccountHint')}"><div class="help">${t('imp.row.newAccountHelp')}</div></div>`:''}`:''}
      ${isSaveable(d)&&d.type!==IMPORT_TYPE.contribution?`<div><label>${t('imp.row.category')}</label><input data-f="cat" list="impCats" value="${esc(displayName(d.cat))}" placeholder="${t('imp.row.categoryHint')}"><datalist id="impCats">${catNames.map(c=>`<option value="${esc(displayName(c))}">`).join('')}</datalist>${chipsBox(d.type===IMPORT_TYPE.income?'receita':'despesa',d.cat)}</div>
      <div><label>${d.type===IMPORT_TYPE.income?t('imp.row.enteredIn'):t('imp.row.paidWith')}</label><select data-f="fonte">${sourceOptions(d)}</select></div>`:''}
    </div>
    ${canSplit(d)?splitHtml(d):''}
    ${d.type===IMPORT_TYPE.ownTransfer&&d.flow==='out'?`<div class="imp-split"><button type="button" class="btn sm ico-btn" data-sp-spent>${svg('pie')}${t('imp.row.wasSpent')}</button>
      <span class="imp-split-sum">${t('imp.row.wasSpentHelp')}</span></div>`:''}
    ${rest?`<label class="check-opt imp-rest"><input type="checkbox" data-f="createRest"${d.createRest?' checked':''}> ${t('imp.row.createRest',{count:rest,range:firstEnd})}</label>`:''}
    ${d.raw?`<div class="imp-raw"><span class="mut">${t('imp.row.fileLine',{line:d.line||''})}</span> <code>${esc(d.raw)}</code></div>`:''}
    <div class="imp-edit-foot"><button type="button" class="btn dng sm" data-imp-del>${t('imp.row.remove2')}</button><button type="button" class="btn pri sm" data-imp-close>${t('imp.common.done')}</button></div>
  </div>`;
}

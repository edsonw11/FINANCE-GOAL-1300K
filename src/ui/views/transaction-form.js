/**
 * ui/views/transaction-form.js
 * Responsibility: Transactions tab: form (type, categories, editing and help text).
 */
import { $, esc } from '../../core/dom.js';
import { m2 } from '../../core/format.js';
import { addDay, addMonths, formatDateBR, today } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { active } from '../../domain/accounts.js';
import { futureSiblings } from '../../domain/transactions.js';
import { icon } from '../../domain/categories.js';
import { closeDateOf, dueDateOf, dueMonth, invoiceMonthOf } from '../../domain/card-cycle.js';
import { alloc } from '../../domain/card-invoices.js';
import { ui } from '../ui-state.js';
import { Sheet } from '../components/sheet.js';
import { drawSplit, resetSplit } from './transaction-split.js';
import { drawInvoiceForm } from './invoice-form.js';
import { NEW_TITLE, formInSheet } from './transaction-form-sheet.js';
import { isQuickPay, renderPay } from './pay-invoice.js';
export function startEdit(id){
  const t=S.tx.find(x=>x.id===id);if(!t)return;
  ui.editId=id;ui.type=t.type;document.querySelector(`input[name=tp][value=${t.type}]`).checked=true;fillCategoryOptions();
  $('fDate').value=t.date;$('fVal').value=m2(t.value);$('fDesc').value=t.desc||'';
  if(t.type==='aporte')$('fAcc').value=t.acc;else $('fCat').value=t.cat||'';
  $('fFonte').value=t.fonte||'caixa';
  if(t.type==='fatura'){$('fFm').value=invoiceMonthOf(t);ui.invoiceSelection=new Set(alloc().map[t.id]||[]);drawInvoiceForm(id);}
  ui.splitRows=(t.splits||[]).map(s=>({cat:s.cat,val:s.value}));$('splitBox').hidden=!(ui.splitRows.length);drawSplit();
  const sib=futureSiblings(t);$('wApply').hidden=!(sib.length);$('fApply').checked=true;$('applyN').textContent=sib.length;
  ui.editId=id;$('fCancel').hidden=false;$('fRep').disabled=true;fillCategoryOptions();
}
export function endEdit(){resetSplit();ui.invoiceSelection=new Set();$('wApply').hidden=true;ui.editId=null;$('fCancel').hidden=true;$('fRep').disabled=false;ui.payAdvanced=false;fillCategoryOptions();}
const SAVE_LABEL={despesa:'Adicionar despesa',receita:'Adicionar receita',aporte:'Registrar aporte',fatura:'Registrar pagamento'};
export function updateSaveLabel(){
  $('fSave').textContent=ui.editId!==null?'Salvar alterações':SAVE_LABEL[ui.type]||'Adicionar';
  $('fCancel').textContent=ui.editId!==null||formInSheet?'Cancelar':'Cancelar edição';
  if(formInSheet&&ui.editId===null&&Sheet.top()&&Sheet.top().static)$('shTitle').textContent=NEW_TITLE[ui.type]||'Novo lançamento';
}
// most used categories of the type (last 6 months) as one-tap chips
function drawCategoryChips(){
  const box=$('catChips');if(!box)return;
  if(ui.type!=='despesa'&&ui.type!=='receita'){box.innerHTML='';return;}
  const from=addMonths(today(),-6),cnt={},on=new Set(((S.cats||{})[ui.type]||[]).filter(c=>!c.off).map(c=>c.name));
  S.tx.forEach(t=>{if(t.type===ui.type&&t.date>=from&&on.has(t.cat))cnt[t.cat]=(cnt[t.cat]||0)+1;});
  let top=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,6);
  if(top.length<6)[...on].forEach(c=>{if(top.length<6&&!top.includes(c))top.push(c);});
  const curV=$('fCat').value.trim();
  box.innerHTML=top.map(c=>`<button type="button" class="chip${c===curV?' on':''}" data-qc="${esc(c)}" aria-pressed="${c===curV}">${icon(ui.type,c)} ${esc(c)}</button>`).join('');
}
export function fillCategoryOptions(){
  const set=new Set(((S.cats||{})[ui.type]||[]).filter(c=>!c.off).map(c=>c.name));
  $('catList').innerHTML=[...set].map(c=>`<option value="${esc(c)}">`).join('');
  $('wCat').hidden=ui.type==='aporte';$('wAcc').hidden=!(ui.type==='aporte');
  const kf=$('fFonte').value;
  $('lFonte').textContent=ui.type==='receita'?'Entrou em':'Pago com';
  $('fFonte').innerHTML=ui.type==='receita'
    ?`<option value="caixa">Conta (entra no caixa)</option><option value="beneficio">VR/VA (cartão benefício)</option>`
    :`<option value="caixa">Conta / Pix / débito</option><option value="cartao">Cartão de crédito</option><option value="beneficio">VR/VA (cartão benefício)</option>`;
  if(kf&&[...$('fFonte').options].some(o=>o.value===kf))$('fFonte').value=kf;
  const noCat=ui.type==='aporte'||ui.type==='fatura';
  $('wCat').hidden=noCat;
  $('wFonte').hidden=noCat;$('wSplit').hidden=noCat;
  const quick=isQuickPay();
  $('fGrid').hidden=quick;$('fActions').hidden=quick;
  $('fatBox').hidden=!(ui.type==='fatura'&&!quick);$('payBox').hidden=!(quick);
  if(ui.type==='fatura'&&!quick)drawInvoiceForm();if(quick)renderPay();
  updateFormHelp();updateSaveLabel();drawCategoryChips();
  const keep=$('fAcc').value;
  $('fAcc').innerHTML=active().map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if(keep)$('fAcc').value=keep;
  updateFormHelp();
}
function cardHint(){const d=$('fDate').value||today(),fm=dueMonth(d);
  return 'Entra na fatura que vence em '+formatDateBR(dueDateOf(fm))+' (ciclo fecha em '+formatDateBR(closeDateOf(fm))+'; a partir de '+formatDateBR(addDay(closeDateOf(fm),1))+' vai para a seguinte). O dinheiro só sai do caixa em “Pagar fatura”.';}
export function updateFormHelp(){
  $('fHelp').textContent=ui.type==='aporte'?'O aporte soma no saldo do investimento escolhido e sai da sua sobra do mês.'
    :ui.type==='fatura'?'Use quando pagar a fatura: o dinheiro sai do caixa, mas não vira gasto de novo (as compras já foram lançadas como “Cartão de crédito”).'
    :(ui.type==='despesa'&&$('fFonte').value==='cartao')?cardHint():'';
}

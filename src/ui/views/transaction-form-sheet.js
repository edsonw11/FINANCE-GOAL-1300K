/**
 * ui/views/transaction-form-sheet.js
 * Responsibility: shows the transaction form inside the sheet, for a new record (button "+",
 * quick buttons on phones) or to edit one. The same form node is moved into the sheet and back,
 * so creating and editing use exactly the same fields, masks and validation. A new record can
 * come filled (prefill: cat, desc, value, date).
 */
import { $ } from '../../core/dom.js';
import { today } from '../../core/dates.js';
import { m2 } from '../../core/format.js';
import { ui } from '../ui-state.js';
import { Sheet } from '../components/sheet.js';
import { clearFieldErrors } from '../components/field-error.js';
import { endEdit, startEdit, updateSaveLabel } from './transaction-form.js';
export let formInSheet=false;
function formView(o){
  return {static:true,
    render(body){
      body.innerHTML='';body.appendChild($('txForm'));formInSheet=true;$('txForm').classList.add('in-sheet');
      clearFieldErrors($('txForm'));
      if(o.id!==undefined&&o.id!==null){startEdit(o.id);}
      else{if(ui.editId!==null)endEdit();
        const r=document.querySelector(`input[name=tp][value=${o.type||ui.type}]`);
        if(r&&!r.checked){r.checked=true;r.dispatchEvent(new Event('change'));}
        if(!$('fDate').value)$('fDate').value=today();
        if(o.prefill)applyPrefill(o.prefill);
        if(ui.type!=='fatura')setTimeout(()=>{if(formInSheet)$('fVal').focus();},250);}
      updateSaveLabel();
      return {title:o.id!=null?'Editar lançamento':NEW_TITLE[ui.type]||'Novo lançamento',sub:o.id!=null?'':'Leva poucos segundos'};
    },
    leave(){
      $('txForm').classList.remove('in-sheet');$('txFormHome').appendChild($('txForm'));formInSheet=false;
      if(ui.editId!==null){endEdit();$('fVal').value='';$('fDesc').value='';}
      clearFieldErrors($('txForm'));
    }};
}
// fills a new record (e.g. "Lançar" a missing bill); the user still reviews and saves
function applyPrefill(p){
  if(p.cat!==undefined)$('fCat').value=p.cat;
  if(p.desc!==undefined)$('fDesc').value=p.desc;
  if(p.value!==undefined)$('fVal').value=m2(p.value);
  if(p.date)$('fDate').value=p.date;
}
export const NEW_TITLE={despesa:'Nova despesa',receita:'Nova receita',aporte:'Novo aporte',fatura:'Pagar fatura'};
export function openTxForm(o){o=o||{};Sheet.depth()?Sheet.push(formView(o)):Sheet.open(formView(o));}
// called after a successful save: back to where the user came from
export function afterFormSave(){if(!formInSheet)return;Sheet.depth()>1?Sheet.pop():Sheet.close();}
export function bindTransactionFormSheet(){
  $('fab').onclick=()=>openTxForm({type:ui.type==='fatura'?'despesa':ui.type});
  document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>openTxForm({type:b.dataset.new}));
  $('fCancel').onclick=()=>{
    if(formInSheet){Sheet.depth()>1?Sheet.pop():Sheet.close();return;}
    endEdit();$('fVal').value='';$('fDesc').value='';clearFieldErrors($('txForm'));};
}

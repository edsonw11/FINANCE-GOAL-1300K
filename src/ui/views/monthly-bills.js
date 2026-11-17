/**
 * ui/views/monthly-bills.js
 * Responsibility: Summary tab card "Contas do mês": the recurring bills of the month (rules in
 * domain/monthly-bills.js) with what is paid, scheduled and still missing. A paid or scheduled
 * bill opens its record; a missing one opens the form already filled ("Lançar"); ✕ hides a
 * bill the rule picked by mistake ("Não é conta").
 */
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { formatDateBR } from '../../core/dates.js';
import { BILL_STATUS, ignoreBill, monthlyBills, restoreIgnoredBills } from '../../domain/monthly-bills.js';
import { icon } from '../../domain/categories.js';
import { ui } from '../ui-state.js';
import { progressBar, PROGRESS_TONE } from '../components/progress-bar.js';
import { runCommand } from '../components/command.js';
import { openTxForm } from './transaction-form-sheet.js';
export const BILL_LABEL={paid:'Paga',scheduled:'Agendada',missing:'Falta lançar'};
let shown=[]; // bills of the last render (the "Lançar" buttons point into it)
function billRow(b,i){
  const title=esc(b.desc||b.cat),approx=b.status===BILL_STATUS.missing?'≈ ':'';
  // the value is repeated in the second line for phones (where the value column is hidden)
  const sub=`<span class="bill-v-sm">${approx}${f2(b.value)} · </span>${esc(b.cat)} · ${b.status===BILL_STATUS.missing?'costuma vir dia '+b.date.slice(8):formatDateBR(b.date)}`;
  const hide=`<button type="button" class="bill-hide" data-bill-hide="${i}" title="Não é uma conta fixa" aria-label="${title} não é conta fixa: ocultar">✕</button>`;
  const tag=`<span class="tag bill-${b.status}">${BILL_LABEL[b.status]}</span>`;
  const main=`<span class="li-ic" aria-hidden="true">${icon('despesa',b.cat)}</span><span class="li-main"><span class="li-t">${title} ${tag}</span><span class="li-s">${sub}</span></span>`;
  if(b.status===BILL_STATUS.missing)
    return `<div class="li li-static bill-row">${main}<span class="li-v mut bill-v">≈ ${f2(b.value)}</span><button type="button" class="btn sm pri" data-bill="${i}" aria-label="Lançar ${title}">Lançar</button>${hide}</div>`;
  return `<div class="li bill-row" data-tx="${b.t.id}" role="button" tabindex="0" aria-label="${title}: ${BILL_LABEL[b.status]}, ${f2(b.value)}">${main}<span class="li-v bill-v">${f2(b.value)}</span>${hide}</div>`;
}
const restoreLink=r=>r.ignoredCount?`<div class="help flush bill-foot">${r.ignoredCount} oculta(s) por você · <button type="button" class="link-btn" data-bill-restore>mostrar de novo</button></div>`:'';
export function renderBills(){
  const box=$('billsCard'),r=monthlyBills(ui.cur);shown=r.items;
  if(!r.count){box.innerHTML=`<div class="card-h"><h2 class="card-t">Contas do mês</h2></div><div class="help flush">As contas que se repetem todo mês (condomínio, luz, água, convênio...) aparecem aqui sozinhas depois de 2 meses, ou na hora se você lançar com “Repetir por N meses”.</div>${restoreLink(r)}`;return;}
  // all paid: one line (the list is still one tap away), so the Summary stays short
  const allPaid=r.paidCount===r.count,list=r.items.map(billRow).join('');
  box.innerHTML=`<div class="card-h"><h2 class="card-t">Contas do mês</h2><div class="help flush">${r.paidCount} de ${r.count} pagas${r.pending>0?' · falta '+f2(r.pending):' · tudo pago ✅'}</div></div>
    ${progressBar(r.paidCount/r.count,r.paidCount===r.count?PROGRESS_TONE.ok:PROGRESS_TONE.near,'Contas pagas')}
    ${allPaid?`<details class="bill-more"><summary>Ver as ${r.count} contas</summary><div class="lst bill-list">${list}</div></details>`:`<div class="lst bill-list">${list}</div>`}${restoreLink(r)}`;
}
export function bindBills(){
  $('billsCard').addEventListener('click',e=>{
    const h=e.target.closest('[data-bill-hide]');
    if(h){e.stopPropagation();const x=shown[+h.dataset.billHide];if(x)runCommand(()=>ignoreBill(x.key),{ok:'“'+(x.desc||x.cat)+'” não aparece mais nas contas do mês'});return;}
    if(e.target.closest('[data-bill-restore]')){runCommand(()=>restoreIgnoredBills(),{ok:r=>r.restored+' conta(s) de volta'});return;}
    const b=e.target.closest('[data-bill]');if(!b)return;const x=shown[+b.dataset.bill];if(!x)return;
    openTxForm({type:'despesa',prefill:{cat:x.cat,desc:x.desc,value:x.value,date:x.date}});});
}

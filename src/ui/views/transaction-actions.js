/**
 * ui/views/transaction-actions.js
 * Responsibility: what happens when a record is tapped: the detail view (all fields) with
 * Editar / Excluir / Fechar, the delete confirmation (naming the item and the value, with the
 * impact explained) and the global tap handling of rows with data-tx.
 */
import { esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { formatDateBR, mLabel, mOf } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { accName } from '../../domain/accounts.js';
import { catParts, deleteTransactions, futureSiblings, invoiceOfPurchase } from '../../domain/transactions.js';
import { icon } from '../../domain/categories.js';
import { dueDateOf, dueMonth, invoiceMonthOf } from '../../domain/card-cycle.js';
import { invoiceItems, invoiceUndetailed } from '../../domain/card-invoices.js';
import { isCard } from '../../domain/month-summary.js';
import { toast } from '../toast.js';
import { Sheet } from '../components/sheet.js';
import { askConfirm } from '../components/confirm.js';
import { TX_SIGN, paymentLabel, txRow, txTitle } from '../components/breakdown.js';
import { runCommand } from '../components/command.js';
import { openTxForm } from './transaction-form-sheet.js';
import { cancelPay } from './pay-invoice.js';
function txDetailView(id){
  return {render(body,foot){
    const t=S.tx.find(x=>x.id===id);if(!t)return null;
    const row=(k,v)=>v?`<div class="dl-r"><dt>${k}</dt><dd>${v}</dd></div>`:'';
    let extra='';
    if(t.type==='despesa'||t.type==='receita'){
      extra+=row('Categoria',t.splits&&t.splits.length?catParts(t).map(p=>`${icon(t.type,p.cat)} ${esc(p.cat)} <span class="mut">${f2(p.value)}</span>`).join('<br>'):`${icon(t.type,t.cat)} ${esc(t.cat)}`);
      extra+=row(t.type==='receita'?'Entrou em':'Pago com',esc(paymentLabel(t)));
      if(isCard(t)){const inv=invoiceOfPurchase(t),fm=dueMonth(t.date);
        extra+=row('Fatura',`Vence em ${formatDateBR(dueDateOf(fm))} · ${inv?'<span class="tag pay-vr">✔ Paga em '+formatDateBR(inv.date)+'</span>':'<span class="tag pay-cartao">Em aberto</span>'}`);}
    }
    if(t.type==='aporte')extra+=row('Investido em','🏦 '+esc(accName(t.acc)));
    if(t.type==='fatura'){const its=invoiceItems(t),u=invoiceUndetailed(t);
      extra+=row('Fatura','Vence em '+formatDateBR(dueDateOf(invoiceMonthOf(t))));
      extra+=row('Compras identificadas',its.length+' · '+f2(sumMoney(its.map(x=>x.value))));
      if(u>0.004)extra+=row('Sem detalhe',`<b class="warn-c">${f2(u)}</b> <span class="mut">(entra como “Cartão (sem detalhe)”)</span>`);
      if(its.length)extra+=`<div class="bd-gh mt-14"><span>Compras desta fatura</span><b>${f2(sumMoney(its.map(x=>x.value)))}</b></div><div class="lst">${its.map(x=>txRow(x)).join('')}</div>`;}
    const sib=futureSiblings(t);
    body.innerHTML=`<div class="dt-head"><span class="tag ${t.type}">${t.type==='fatura'?'Fatura paga':t.type[0].toUpperCase()+t.type.slice(1)}</span>
      <div class="dt-v li-v ${t.type}">${TX_SIGN[t.type]} ${f2(t.value)}</div><div class="dt-t">${esc(txTitle(t))}</div></div>
      <dl class="dl">${row('Data',formatDateBR(t.date)+' <span class="mut">('+new Date(t.date+'T12:00').toLocaleDateString('pt-BR',{weekday:'long'})+')</span>')}${extra}${row('Descrição',t.desc?esc(t.desc):'<span class="mut">sem descrição</span>')}
      ${sib.length?row('Repetição','🔁 Mais '+sib.length+' lançamento(s) igual(is) nos próximos meses'):''}${t.demo?row('Origem','🧪 Dado de teste'):''}</dl>`;
    foot.innerHTML=`<button type="button" class="btn dng" data-act="del">${t.type==='fatura'?'Cancelar pagamento':'Excluir'}</button><button type="button" class="btn pri" data-act="edit">Editar</button>`;
    foot.querySelector('[data-act=del]').onclick=()=>deleteTxFlow(t.id);
    foot.querySelector('[data-act=edit]').onclick=()=>openTxForm({id:t.id});
    return {title:t.type==='fatura'?'Pagamento de fatura':'Detalhes do lançamento',sub:mLabel(mOf(t.date))};
  }};
}
export async function deleteTxFlow(id){
  const t=S.tx.find(x=>x.id===id);if(!t)return false;
  if(t.type==='fatura')return cancelPay(t);
  const sib=futureSiblings(t),inv=isCard(t)&&t.type==='despesa'?invoiceOfPurchase(t):null;
  const name=t.type==='aporte'?accName(t.acc):(t.desc||t.cat);
  let html=`Deseja excluir ${t.type==='receita'?'a receita':t.type==='aporte'?'o aporte em':'a despesa'} <b>“${esc(name)}”</b>, no valor de <b>${f2(t.value)}</b>, de ${formatDateBR(t.date)}?`;
  if(inv)html+=`<div class="bd-note mt-10">Esta compra está na fatura paga em ${formatDateBR(inv.date)}. O valor dela passa a aparecer como “Cartão (sem detalhe)”, então o total de despesas do mês não muda.</div>`;
  if(t.type==='aporte')html+=`<div class="bd-note mt-10">O saldo de ${esc(accName(t.acc))} diminui ${f2(t.value)}.</div>`;
  const r=await askConfirm({title:t.type==='aporte'?'Excluir aporte':'Excluir lançamento',html,ok:'Excluir',danger:true,
    check:sib.length?`Excluir também os ${sib.length} lançamento(s) futuro(s) iguais`:''});
  if(!r)return false;
  const ids=[t.id].concat(r.checked?sib.map(x=>x.id):[]);
  if(!runCommand(()=>deleteTransactions(ids)))return false;
  toast('🗑️ '+(ids.length>1?ids.length+' lançamentos excluídos':'Lançamento excluído')+': '+name);
  return true;
}
function openTxDetail(id){Sheet.depth()?Sheet.push(txDetailView(id)):Sheet.open(txDetailView(id));}
// any element with data-tx opens the record; buttons inside the row keep their own action
export function bindTransactionTaps(){
  const go=e=>{const r=e.target.closest('[data-tx]');if(!r)return false;
    const inner=e.target.closest('button,a,input,select,label');if(inner&&inner!==r&&r.contains(inner))return false;
    openTxDetail(+r.dataset.tx);return true;};
  document.addEventListener('click',go);
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-tx],[role=button][data-go]')){e.preventDefault();e.target.click();}});
}

/**
 * ui/views/month-details.js
 * Responsibility: what each month summary card opens (Receitas, Despesas, Aportes, Sobrou no caixa,
 * Saldo VR/VA). Every list comes from monthSummary(), the same source as the card.
 */
import { f2 } from '../../core/format.js';
import { formatDateBR, mIdx, mKey, mLabel, monthEnd } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { monthSummary } from '../../domain/month-summary.js';
import { UNDETAILED_CAT } from '../../domain/spending.js';
import { Sheet } from '../components/sheet.js';
import { infoRow, listView, signedMoney, txRow } from '../components/breakdown.js';
import { registerDetail, registerLink } from '../components/detail-registry.js';
export const periodOf=m=>mLabel(m).replace(/^./,c=>c.toUpperCase());
const byDateDesc=a=>a.slice().sort((x,y)=>y.date.localeCompare(x.date)||y.id-x.id);
const txRows=a=>byDateDesc(a).map(t=>txRow(t));
const MONTH_DETAILS={
  income:(s,m,P)=>({title:'Receitas',sub:P,total:'+ '+f2(s.income.total),totalLabel:'Total recebido',period:P,
        groups:[{rows:txRows(s.income.items)}],empty:'Nenhuma receita neste mês. Toque em “+” para adicionar.'}),
  expenses:(s,m,P)=>({title:'Despesas',sub:P,total:'− '+f2(s.expenses.total),totalLabel:'Total gasto',period:P,
        count:s.expenses.items.length+s.expenses.undetailed.length,
        groups:[{label:'Lançadas',total:f2(sumMoney(s.expenses.items.map(t=>t.value))),rows:txRows(s.expenses.items)},
          {label:'Faturas pagas sem detalhe',total:f2(sumMoney(s.expenses.undetailed.map(u=>u.value))),
           rows:s.expenses.undetailed.map(u=>txRow(u.invoice,{value:u.value,sign:'−',title:'❓ '+UNDETAILED_CAT,sub:'Parte da fatura paga em '+formatDateBR(u.invoice.date)+' sem compras lançadas'}))}],
        note:'Inclui compras no cartão e no VR/VA. O pagamento da fatura não entra de novo (as compras já contam).'}),
  contrib:(s,m,P)=>({title:'Aportes',sub:P,total:'→ '+f2(s.contributions.total),totalLabel:'Total investido',period:P,
        groups:[{rows:txRows(s.contributions.items)}].concat(s.reinvestments.items.length?[{label:'🔁 Reinvestimentos (não contam)',total:f2(s.reinvestments.total),rows:txRows(s.reinvestments.items)}]:[]),
        note:s.reinvestments.items.length?'Reinvestimento é dinheiro que já estava investido (um CDB que venceu): aparece aqui só para você ver, e não entra no total investido nem na sobra do mês.':'',
        empty:'Nenhum aporte neste mês.'}),
  cash:(s,m,P)=>{const c=s.cash,t=a=>f2(sumMoney(a.map(x=>x.value)));
        return {title:'Sobrou no caixa',sub:P,total:`<span class="${c.total>=0?'pos':'neg'}">${signedMoney(c.total)}</span>`,totalLabel:'Resultado do mês',period:P,
        count:c.cashIn.length+c.cashOut.length+c.invoices.length+c.contributions.length,
        note:'Conta: <b>entradas na conta</b> − <b>saídas pela conta</b> − <b>faturas pagas</b> − <b>aportes</b>. Compras no cartão só saem do caixa quando a fatura é paga; VR/VA fica fora.',
        groups:[{label:'➕ Entradas na conta',total:'+ '+t(c.cashIn),rows:txRows(c.cashIn),always:true},
          {label:'➖ Saídas pela conta (Pix, débito)',total:'− '+t(c.cashOut),rows:txRows(c.cashOut),always:true},
          {label:'💳 Faturas pagas',total:'− '+t(c.invoices),rows:txRows(c.invoices),always:true},
          {label:'🏦 Aportes',total:'− '+t(c.contributions),rows:byDateDesc(c.contributions).map(t=>txRow(t,{sign:'−'})),always:true}]};},
  voucher:(s,m,P)=>{const v=s.voucher;
        return {title:'Saldo VR/VA',sub:'Até '+formatDateBR(monthEnd(m)),total:signedMoney(v.total),totalLabel:'Saldo no fim do mês',
        count:v.items.length,
        groups:[{label:'Saldo anterior',rows:[infoRow({icon:'💰',title:'Saldo até '+mLabel(mKey(mIdx(m)-1)),value:signedMoney(v.before)})]},
          {label:'Movimentos do mês',total:`+ ${f2(v.inMonth)} · − ${f2(v.outMonth)}`,rows:txRows(v.items),always:true}]};},
};
const monthDetailView=(key,m)=>listView(()=>MONTH_DETAILS[key](monthSummary(m),m,periodOf(m)));
export function registerMonthDetails(){
  Object.keys(MONTH_DETAILS).forEach(key=>registerDetail(key,m=>monthDetailView(key,m)));
  // a month row (in the trend lists) opens the expenses of that month
  registerLink('month',el=>Sheet.push(monthDetailView('expenses',el.dataset.m)));
}

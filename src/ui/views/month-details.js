/**
 * ui/views/month-details.js
 * Responsibility: what each month summary card opens (Receitas, Despesas, Aportes, Sobrou no caixa,
 * Saldo VR/VA). Every list comes from monthSummary(), the same source as the card.
 */
import { f2 } from '../../core/format.js';
import { tt } from '../../core/i18n.js';
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
  income:(s,m,P)=>({title:tt('sum.common.income'),sub:P,total:'+ '+f2(s.income.total),totalLabel:tt('sum.month.totalReceived'),period:P,
        groups:[{rows:txRows(s.income.items)}],empty:tt('sum.month.noIncome')}),
  expenses:(s,m,P)=>({title:tt('sum.common.expenses'),sub:P,total:'− '+f2(s.expenses.total),totalLabel:tt('sum.month.totalSpent'),period:P,
        count:s.expenses.items.length+s.expenses.undetailed.length,
        groups:[{label:tt('sum.month.entered'),total:f2(sumMoney(s.expenses.items.map(t=>t.value))),rows:txRows(s.expenses.items)},
          {label:tt('sum.month.undetailedInvoices'),total:f2(sumMoney(s.expenses.undetailed.map(u=>u.value))),
           rows:s.expenses.undetailed.map(u=>txRow(u.invoice,{value:u.value,sign:'−',title:'❓ '+UNDETAILED_CAT,sub:tt('sum.month.undetailedSub',{date:formatDateBR(u.invoice.date)})}))}],
        note:tt('sum.month.expensesNote')}),
  contrib:(s,m,P)=>({title:tt('sum.common.contributions'),sub:P,total:'→ '+f2(s.contributions.total),totalLabel:tt('sum.month.totalInvested'),period:P,
        groups:[{rows:txRows(s.contributions.items)}].concat(s.reinvestments.items.length?[{label:tt('sum.month.reinvestments'),total:f2(s.reinvestments.total),rows:txRows(s.reinvestments.items)}]:[]),
        note:s.reinvestments.items.length?tt('sum.month.reinvestNote'):'',
        empty:tt('sum.month.noContrib')}),
  cash:(s,m,P)=>{const c=s.cash,t=a=>f2(sumMoney(a.map(x=>x.value)));
        return {title:tt('sum.month.cashTitle'),sub:P,total:`<span class="${c.total>=0?'pos':'neg'}">${signedMoney(c.total)}</span>`,totalLabel:tt('sum.month.cashTotal'),period:P,
        count:c.cashIn.length+c.cashOut.length+c.invoices.length+c.contributions.length,
        note:tt('sum.month.cashNote'),
        groups:[{label:tt('sum.month.cashIn'),total:'+ '+t(c.cashIn),rows:txRows(c.cashIn),always:true},
          {label:tt('sum.month.cashOut'),total:'− '+t(c.cashOut),rows:txRows(c.cashOut),always:true},
          {label:tt('sum.month.paidInvoices'),total:'− '+t(c.invoices),rows:txRows(c.invoices),always:true},
          {label:tt('sum.month.cashContrib'),total:'− '+t(c.contributions),rows:byDateDesc(c.contributions).map(t=>txRow(t,{sign:'−'})),always:true}]};},
  voucher:(s,m,P)=>{const v=s.voucher;
        return {title:tt('sum.common.voucherBalance'),sub:tt('sum.month.until',{date:formatDateBR(monthEnd(m))}),total:signedMoney(v.total),totalLabel:tt('sum.month.endBalance'),
        count:v.items.length,
        groups:[{label:tt('sum.month.previousBalance'),rows:[infoRow({icon:'💰',title:tt('sum.month.balanceUntil',{month:mLabel(mKey(mIdx(m)-1))}),value:signedMoney(v.before)})]},
          {label:tt('sum.month.movements'),total:`+ ${f2(v.inMonth)} · − ${f2(v.outMonth)}`,rows:txRows(v.items),always:true}]};},
};
const monthDetailView=(key,m)=>listView(()=>MONTH_DETAILS[key](monthSummary(m),m,periodOf(m)));
export function registerMonthDetails(){
  Object.keys(MONTH_DETAILS).forEach(key=>registerDetail(key,m=>monthDetailView(key,m)));
  // a month row (in the trend lists) opens the expenses of that month
  registerLink('month',el=>Sheet.push(monthDetailView('expenses',el.dataset.m)));
}

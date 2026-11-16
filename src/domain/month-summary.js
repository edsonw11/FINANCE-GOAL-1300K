/**
 * domain/month-summary.js
 * Responsibility: the numbers of the month summary and the records behind each one.
 * The dashboard cards and their detail lists both read from here, so the sum of the listed
 * items is always the card total (same filters, same rule, summed in cents).
 */
import { mOf, monthEnd } from '../core/dates.js';
import { sumMoney } from '../core/money.js';
import { S } from './store.js';
import { txIn } from './transactions.js';
import { invoiceUndetailed, openCard } from './card-invoices.js';
const isVoucher=t=>t.fonte==='beneficio';
export const isCard=t=>t.fonte==='cartao';
const signedVoucher=t=>t.type==='receita'?t.value:t.type==='despesa'?-t.value:0;
export function monthSummary(m){
  const end=monthEnd(m),start=m+'-01';
  const income=txIn(m,'receita'),expenses=txIn(m,'despesa'),contributions=txIn(m,'aporte'),invoices=txIn(m,'fatura');
  // part of a paid invoice with no purchase entered: it is still a cost of the month
  const undetailed=invoices.map(t=>({invoice:t,value:invoiceUndetailed(t)})).filter(x=>x.value>0.004);
  const cashIn=income.filter(t=>!isVoucher(t)),cashOut=expenses.filter(t=>!isVoucher(t)&&!isCard(t));
  const openCardItems=openCard(end);
  const voucherBefore=sumMoney(S.tx.filter(t=>isVoucher(t)&&t.date<start).map(signedVoucher));
  const voucherItems=S.tx.filter(t=>isVoucher(t)&&mOf(t.date)===m&&(t.type==='receita'||t.type==='despesa'));
  const val=a=>a.map(t=>t.value);
  const r={
    m,
    income:{items:income,total:sumMoney(val(income))},
    expenses:{items:expenses,undetailed,total:sumMoney(val(expenses).concat(undetailed.map(u=>u.value)))},
    contributions:{items:contributions,total:sumMoney(val(contributions))},
    cash:{cashIn,cashOut,invoices,contributions,
      total:sumMoney(val(cashIn).concat(val(cashOut).map(v=>-v),val(invoices).map(v=>-v),val(contributions).map(v=>-v)))},
    openCard:{items:openCardItems,total:sumMoney(val(openCardItems))},
    cardBought:sumMoney(val(expenses.filter(isCard))),
    invoicesPaid:sumMoney(val(invoices)),
    voucher:{before:voucherBefore,items:voucherItems,
      inMonth:sumMoney(val(voucherItems.filter(t=>t.type==='receita'))),
      outMonth:sumMoney(val(voucherItems.filter(t=>t.type==='despesa'))),
      total:sumMoney([voucherBefore].concat(voucherItems.map(signedVoucher)))}
  };
  return r;
}
// month spending total used by the trend chart, the insights and the category detail
export const monthSpending=m=>monthSummary(m).expenses.total;

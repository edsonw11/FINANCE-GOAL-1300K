/**
 * specs/d07.mjs
 * Responsibility: diagram 07, the rules engine: the calculations and classifications the app really makes, each with its constants and its source.
 */
import { e, lane, n } from './helpers.mjs';
export default {
  id: '07-financial-analysis-engine',
  pages: [{
    title: 'Everfox: Rules and Calculations',
    subtitle: 'Everything is a pure rule over the state S (transactions, accounts and balance snapshots, trades, settings). No score or ranking of assets exists in this product.',
    lanes: [
      lane('in', 'Data the rules read', 'infra', [
        n('r-tx', 'Transactions', 'Income, expense, aporte (money into an investment), card purchases and invoice payments.', 'src/domain/transactions.js', 'txIn'),
        n('r-acc', 'Accounts and balances', 'Each account has dated balance snapshots; a balance on a day comes from them.', 'src/domain/accounts.js', 'balance'),
        n('r-trades', 'Trades', 'Buys and sells read from B3 brokerage notes.', 'src/domain/portfolio.js', 'tradesOf'),
        n('r-set', 'Settings', 'Goal (default 1,300,000), yearly rate (default 12.5%), planned monthly contribution, card days.', 'src/domain/store.js', 'blankState'),
      ], { col: 0 }),
      lane('month', 'Month numbers', 'dom', [
        n('r-sum', 'Month summary', 'Income, expenses and contributions of a month, with the records behind each number.', 'src/domain/month-summary.js', 'monthSummary'),
        n('r-res', 'Month result', 'left = income - expenses; rate = left / income (none without income); kept = left - invested.', 'src/domain/month-result.js', 'monthResult'),
        n('r-lvl', 'Savings level', 'rate below 0: negative; below 10%: low; 10% to 20%: ok; 20% or more: good.', 'src/domain/savings.js', 'savingsLevel'),
        n('r-bud', 'Budget by group', 'Share of the budget used: up to 80% ok, from 80% near, above 100% over.', 'src/domain/budgets.js', 'budgetStatus'),
        n('r-bill', 'Monthly bills', 'Recurring expenses found in the last 3 months (at least 2 times, amount varying up to 20%).', 'src/domain/monthly-bills.js', 'monthlyBills'),
      ], { col: 1 }),
      lane('card', 'Credit card', 'dom', [
        n('r-cyc', 'Cycle and invoice month', 'Best purchase day starts the invoice; closing is the day before; due is the next due day after closing; a purchase belongs to the first invoice whose closing has not passed. Weekend closing moves to the next business day if the option is on.', 'src/domain/card-cycle.js', 'dueMonth'),
        n('r-inv', 'Invoice items and undetailed amount', 'Which purchases belong to an invoice, and what the invoice total leaves undetailed.', 'src/domain/card-invoices.js', 'invoiceUndetailed'),
        n('r-pay', 'Invoice payment', 'Plans and records a full or partial payment.', 'src/domain/invoice-payment.js', 'planPayment'),
      ], { col: 2 }),
      lane('wealth', 'Goal and wealth', 'dom', [
        n('r-proj', 'Goal projection', 'monthly rate = (1 + yearly/100)^(1/12) - 1; each month: balance + interest + planned contribution. A second line uses the rate 2 points lower.', 'src/domain/goal-projection.js', 'projectionPlan'),
        n('r-real', 'Real series and average contribution', 'Net worth by month from the balances; average of real contributions.', 'src/domain/investments.js', 'realSeries'),
        n('r-res6', 'Emergency reserve', 'Reserve balance divided by the average expense of the last 3 closed months; target 6 months, minimum 3.', 'src/domain/emergency-fund.js', 'emergencyFund'),
        n('r-pos', 'Portfolio positions', 'Per ticker: quantity, average cost (costs included), amount invested, result of what was sold.', 'src/domain/portfolio.js', 'positions'),
        n('r-alloc', 'Allocation target', 'Optional target share per kind of asset; within 2 points of the target counts as on target.', 'src/domain/allocation.js', 'allocationStatus'),
      ], { col: 1, row: 1 }),
      lane('imp', 'Import classification', 'dec', [
        n('r-imp', 'What an entry is', 'Balance line: dropped. Invoice payment, own transfer, refund, redemption, yield or tax: not income or expense on their own. Pix, TED and doc: flagged to confirm. "PARC 03/10": read as an installment.', 'src/domain/import-classify.js', 'IMPORT_TYPE'),
        n('r-own', 'Own-account transfers', 'Pairs the two sides of a transfer between the person\'s accounts, so it is neither income nor expense.', 'src/domain/transfers.js', 'markTransferPairs'),
      ], { col: 3 }),
    ],
    edges: [
      e('r-tx', 'r-sum', 'by month'),
      e('r-sum', 'r-res'),
      e('r-res', 'r-lvl'),
      e('r-acc', 'r-real', 'balances'),
      e('r-set', 'r-proj', 'goal, rate, plan'),
      e('r-trades', 'r-pos'),
    ],
    notes: ['Constants are the ones in the code at the time of the build (see the traceability matrix for the line of each).'],
  }],
};

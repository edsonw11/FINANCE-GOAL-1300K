/**
 * ui/render.js
 * Responsibility: Orchestrates rendering of every screen (and the open detail panel).
 */
import { initCats } from '../domain/categories.js';
import { prepareMoneyInputs } from './components/money-input.js';
import { Sheet } from './components/sheet.js';
import { stackTables } from './components/stack-table.js';
import { renderMeta } from './views/goal.js';
import { renderFlow } from './views/summary-cashflow.js';
import { renderBudgets } from './views/budget-card.js';
import { renderBills } from './views/monthly-bills.js';
import { renderTrend } from './views/summary-trend.js';
import { renderCardBox, renderCycles } from './views/credit-card.js';
import { renderTransactions } from './views/transaction-list.js';
import { fillInvoiceMonths } from './views/invoice-form.js';
import { renderInvestments } from './views/investments.js';
import { renderCategories } from './views/categories.js';
import { renderSettings } from './views/settings.js';
import { renderBackup } from './views/backup.js';
export function render(){initCats();renderMeta();renderFlow();renderBudgets();renderBills();renderTrend();renderCycles();renderCardBox();renderTransactions();renderInvestments();renderSettings();renderBackup();renderCategories();
  fillInvoiceMonths();stackTables();prepareMoneyInputs();Sheet.refresh();}

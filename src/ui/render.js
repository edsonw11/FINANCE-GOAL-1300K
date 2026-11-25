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
import { renderTodo } from './views/summary-todo.js';
import { renderStart } from './views/summary-start.js';
import { renderHero } from './views/summary-hero.js';
import { renderBudgets } from './views/budget-card.js';
import { renderBills } from './views/monthly-bills.js';
import { renderTrend } from './views/summary-trend.js';
import { renderCycles } from './views/credit-card.js';
import { renderTransactions } from './views/transaction-list.js';
import { fillInvoiceMonths } from './views/invoice-form.js';
import { renderInvestments } from './views/investments.js';
import { renderCategories } from './views/categories.js';
import { renderSettings } from './views/settings.js';
import { renderOwnNames } from './views/own-names-view.js';
import { renderBackup } from './views/backup.js';
import { renderSync } from './views/sync-view.js';
export function render(){initCats();renderMeta();renderFlow();renderStart();renderTodo();renderHero();renderBudgets();renderBills();renderTrend();renderCycles();renderTransactions();renderInvestments();renderSettings();renderOwnNames();renderBackup();renderSync();renderCategories();
  fillInvoiceMonths();stackTables();prepareMoneyInputs();Sheet.refresh();}

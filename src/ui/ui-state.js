/**
 * ui/ui-state.js
 * Responsibility: what the screen is showing right now (period, filters, form being edited).
 * It is not saved and it is not business data: the domain never reads it.
 * One shared object so every screen reads and changes the same values (ES modules cannot
 * reassign a variable owned by another module).
 */
import { mOf, today } from '../core/dates.js';
export const ui={
  cur:mOf(today()),          // month shown (YYYY-MM)
  type:'despesa',            // type selected in the transaction form
  filt:'todos',              // transaction list filter chip
  q:'',                      // transaction list search
  group:'',                  // transaction list expense group ('' = all)
  editId:null,               // transaction being edited (null = new)
  splitRows:[],              // split parts in the form [{cat,val}]
  invoiceSelection:new Set(),// purchases checked in the invoice form
  payAdvanced:false,         // invoice payment entered manually
  allInvoicesOpen:false,     // Card tab: the table with all invoices is expanded
  selectedInsightCategory:null // category highlighted in the analysis table
};

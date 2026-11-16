/** Dates without timezone shift and the credit card cycle (core/dates.js, domain/card-cycle.js). */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('dates');
  eq('date to dd/mm/aaaa',run("formatDateBR('2026-10-05')"),'05/10/2026');
  eq('add month at month end',run("addMonths('2026-01-31',1)"),'2026-02-28');
  eq('month of date',run("mOf('2026-10-05')"),'2026-10');
  eq('month end (feb)',run("monthEnd('2026-02')"),'2026-02-28');
  eq('purchase before best day -> next invoice',run("dueMonth('2026-10-28')"),'2026-11');
  eq('purchase on best day -> invoice after',run("dueMonth('2026-10-29')"),'2026-12');
  eq('due date',run("dueDateOf('2026-11')"),'2026-11-07');
  return res;};

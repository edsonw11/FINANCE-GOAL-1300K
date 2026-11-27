/**
 * ui/views/summary-todo.js
 * Responsibility: "O que fazer agora" on the Summary: the few urgent things from domain/todo-list.js,
 * each one a button to the tab where it is solved (navigation binds the click).
 */
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { today } from '../../core/dates.js';
import { t } from '../../core/i18n.js';
import { nextActions } from '../../domain/todo-list.js';
import { invoiceName } from '../invoice-name.js';
const ACTION_TEXT={
  'invoice-late':a=>a.count>1?t('sum.todo.lateMany',{count:a.count,rest:f2(a.rest)}):t('sum.todo.lateOne',{name:invoiceName(a.fm),rest:f2(a.rest)}),
  'invoice-due':a=>t(a.days===1?'sum.todo.dueOne':'sum.todo.dueMany',{name:invoiceName(a.fm),days:a.days,rest:f2(a.rest)}),
  'budget-over':a=>t('sum.todo.budgetOver',{groups:a.groups.map(esc).join(', ')}),
  'bills-missing':a=>t('sum.todo.billsMissing',{count:a.count}),
  'no-contribution':()=>t('sum.todo.noContribution'),
  'no-reserve':()=>t('sum.todo.noReserve')};
// domain "go" -> tab id
export const ACTION_TAB={card:'cartao',budget:'resumo',bills:'resumo',invest:'inv'};
export function renderTodo(){
  const items=nextActions(today());
  $('todoCard').hidden=!items.length;
  $('todoCard').innerHTML=items.length?`<h3 class="m0">${t('sum.todo.title')}</h3><div class="todo">${items.map(a=>
    `<button type="button" class="todo-item" data-todo="${ACTION_TAB[a.go]}">${ACTION_TEXT[a.code](a.data)}<span aria-hidden="true">›</span></button>`).join('')}</div>`:'';
}

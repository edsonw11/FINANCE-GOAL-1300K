/**
 * ui/views/summary-todo.js
 * Responsibility: "O que fazer agora" on the Summary: the few urgent things from domain/todo-list.js,
 * each one a button to the tab where it is solved (navigation binds the click).
 */
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { today } from '../../core/dates.js';
import { nextActions } from '../../domain/todo-list.js';
import { invoiceName } from '../invoice-name.js';
const ACTION_TEXT={
  'invoice-late':a=>a.count>1?`🔴 ${a.count} faturas vencidas sem pagamento lançado (${f2(a.rest)})`:`🔴 ${invoiceName(a.fm)} venceu e não foi paga (${f2(a.rest)})`,
  'invoice-due':a=>`🟡 ${invoiceName(a.fm)} vence em ${a.days} dia${a.days===1?'':'s'} (${f2(a.rest)})`,
  'budget-over':a=>`🟠 Passou do limite: ${a.groups.map(esc).join(', ')}`,
  'bills-missing':a=>`🧾 ${a.count} conta${a.count===1?'':'s'} do mês ainda não lançada${a.count===1?'':'s'}`,
  'no-contribution':()=>'📈 Nenhum aporte neste mês ainda',
  'no-reserve':()=>'🛟 Marque qual investimento é sua reserva de emergência'};
// domain "go" -> tab id
export const ACTION_TAB={card:'cartao',budget:'resumo',bills:'resumo',invest:'inv'};
export function renderTodo(){
  const items=nextActions(today());
  $('todoCard').hidden=!items.length;
  $('todoCard').innerHTML=items.length?`<h3 class="m0">O que fazer agora</h3><div class="todo">${items.map(a=>
    `<button type="button" class="todo-item" data-todo="${ACTION_TAB[a.go]}">${ACTION_TEXT[a.code](a.data)}<span aria-hidden="true">›</span></button>`).join('')}</div>`:'';
}

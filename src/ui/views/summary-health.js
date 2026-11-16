/**
 * ui/views/summary-health.js
 * Responsibility: the top of the Summary tab: "O que fazer agora" (few urgent things, each one
 * opens the right place), the savings rate of the month and the emergency reserve in months.
 * Only builds text from domain results; the domain decides the levels.
 */
import { $, esc } from '../../core/dom.js';
import { f2, pc } from '../../core/format.js';
import { mShort, today } from '../../core/dates.js';
import { savingsRate } from '../../domain/savings.js';
import { emergencyFund } from '../../domain/emergency-fund.js';
import { nextActions } from '../../domain/todo-list.js';
import { ui } from '../ui-state.js';
const ACTION_TEXT={
  'invoice-late':a=>a.count>1?`🔴 ${a.count} faturas vencidas sem pagamento lançado (${f2(a.rest)})`:`🔴 Fatura de ${mShort(a.fm)} venceu e não foi paga (${f2(a.rest)})`,
  'invoice-due':a=>`🟡 Fatura de ${mShort(a.fm)} vence em ${a.days} dia${a.days===1?'':'s'} (${f2(a.rest)})`,
  'budget-over':a=>`🟠 Passou do limite: ${a.groups.map(esc).join(', ')}`,
  'bills-missing':a=>`🧾 ${a.count} conta${a.count===1?'':'s'} do mês ainda não lançada${a.count===1?'':'s'}`,
  'no-contribution':()=>'📈 Nenhum aporte neste mês ainda'};
const ACTION_TAB={card:'card',budget:'resumo',bills:'resumo',invest:'inv'};
const SAVINGS_TEXT={
  good:'Excelente: você guardou boa parte do que ganhou.',ok:'Bom: dá para chegar a 20% se cortar um pouco.',
  low:'Pouco: sobrou menos de 10% da renda.',negative:'Você gastou mais do que ganhou neste mês.',none:'Sem receitas neste mês para calcular.'};
const RESERVE_TEXT={
  good:'Reserva confortável.',ok:'Reserva razoável: a meta é 6 meses.',low:'Reserva curta: a meta é 6 meses.',none:''};
export function renderHealth(){
  const items=nextActions(today());
  $('todoCard').hidden=!items.length;
  $('todoCard').innerHTML=items.length?`<h3 class="m0">O que fazer agora</h3><div class="todo">${items.map(a=>
    `<button type="button" class="todo-item" data-todo="${ACTION_TAB[a.go]}">${ACTION_TEXT[a.code](a.data)}<span aria-hidden="true">›</span></button>`).join('')}</div>`:'';
  const s=savingsRate(ui.cur),r=emergencyFund(today());
  const sv=s.rate===null?'—':pc(s.rate);
  const reserve=!r.accounts.length
    ?`<div class="v">—</div><div class="n">Marque uma conta como “🛟 Reserva” na aba Patrimônio para ver quantos meses ela cobre.</div>`
    :r.months===null?`<div class="v">${f2(r.balance)}</div><div class="n">Falta histórico de despesas para calcular os meses.</div>`
    :`<div class="v">${r.months.toFixed(1).replace('.',',')} meses</div><div class="n">${f2(r.balance)} cobrem ${r.months.toFixed(1).replace('.',',')} meses de gastos (média ${f2(r.monthlyExpense)}/mês). ${RESERVE_TEXT[r.level]}</div>`;
  $('healthRow').innerHTML=
    `<div class="card kpi health ${s.level}"><div class="k">💚 Taxa de poupança</div><div class="v">${sv}</div><div class="n">${s.rate===null?'':`Sobrou ${f2(s.saved)} de ${f2(s.income)}. `}${SAVINGS_TEXT[s.level]}</div></div>
     <div class="card kpi health ${r.level}"><div class="k">🛟 Reserva de emergência</div>${reserve}</div>`;
}

/**
 * ui/views/settings.js
 * Responsibility: Settings tab: goal assumptions and credit card settings.
 */
import { $, esc } from '../../core/dom.js';
import { f0, m2, parse } from '../../core/format.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { accName } from '../../domain/accounts.js';
import { avgContribution, realSeries } from '../../domain/investments.js';
import { CARD } from '../../domain/card-cycle.js';
import { setCardSettings, setGoalSettings, setPlannedContribution } from '../../domain/settings-commands.js';
import { runCommand } from '../components/command.js';
export function renderSettings(){
  if(document.activeElement!==$('goal'))$('goal').value=m2(S.goal);
  if(document.activeElement!==$('rate'))$('rate').value=String(S.rate).replace('.',',');
  $('cClose').value=CARD().best;$('cBiz').checked=CARD().biz!==false;$('cDue').value=CARD().due;
  if(document.activeElement!==$('planned'))$('planned').value=m2(S.planned);
  const real=realSeries(),av=avgContribution(real);
  $('avgHelp').innerHTML=`Sua média real de aportes: <b>${f0(av)}/mês</b> ${av>0?'<button class="btn sm" id="useAvg">usar na projeção</button>':''}`;
  const b=$('useAvg');if(b)b.onclick=()=>runCommand(()=>setPlannedContribution(av),{ok:'Projeção usando '+f0(av)+'/mês'});
  const est=S.snaps.filter(s=>s.est);
  $('estNote').hidden=!(est.length);
  $('estNote').innerHTML=`🟠 Alguns saldos iniciais são <b>estimados</b> (${est.map(s=>esc(accName(s.acc))).join(', ')}). Em Investimentos, use “Atualizar saldos” com os valores líquidos reais para substituí-los.`;
}
export function bindSettings(){
['cClose','cDue','cBiz'].forEach(id=>$(id).onchange=()=>runCommand(()=>setCardSettings({best:parse($('cClose').value),due:parse($('cDue').value),biz:$('cBiz').checked}),
  {ok:r=>'Cartão: melhor dia de compra '+r.best+' e vencimento dia '+r.due}));
['goal','rate','planned'].forEach(id=>$(id).onchange=()=>runCommand(()=>setGoalSettings({goal:parseMoney($('goal').value),rate:parse($('rate').value),planned:parseMoney($('planned').value)})));
$('printBtn').onclick=()=>window.print();
}

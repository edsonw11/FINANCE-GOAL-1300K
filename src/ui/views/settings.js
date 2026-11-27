/**
 * ui/views/settings.js
 * Responsibility: Settings tab: goal assumptions and credit card settings.
 */
import { t } from '../../core/i18n.js';
import { $, esc } from '../../core/dom.js';
import { f0, m2, parse } from '../../core/format.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { accName } from '../../domain/accounts.js';
import { avgContribution, realSeries } from '../../domain/investments.js';
import { CARD } from '../../domain/card-cycle.js';
import { setCardSettings, setGoalSettings, setPlannedContribution } from '../../domain/settings-commands.js';
import { runCommand } from '../components/command.js';
import { renderLanguageCard } from './language-settings.js';
export function renderSettings(){
  renderLanguageCard();
  if(document.activeElement!==$('goal'))$('goal').value=m2(S.goal);
  if(document.activeElement!==$('rate'))$('rate').value=String(S.rate).replace('.',',');
  $('cClose').value=CARD().best;$('cBiz').checked=CARD().biz!==false;$('cDue').value=CARD().due;
  if(document.activeElement!==$('planned'))$('planned').value=m2(S.planned);
  const real=realSeries(),av=avgContribution(real);
  $('avgHelp').innerHTML=t('set.main.avgHelp',{value:f0(av),button:av>0?`<button class="btn sm" id="useAvg">${t('set.main.useAvg')}</button>`:''});
  const b=$('useAvg');if(b)b.onclick=()=>runCommand(()=>setPlannedContribution(av),{ok:t('set.main.projection',{value:f0(av)})});
  const est=S.snaps.filter(s=>s.est);
  $('estNote').hidden=!(est.length);
  $('estNote').innerHTML=t('set.main.estimated',{accounts:est.map(s=>esc(accName(s.acc))).join(', ')});
}
export function bindSettings(){
['cClose','cDue','cBiz'].forEach(id=>$(id).onchange=()=>runCommand(()=>setCardSettings({best:parse($('cClose').value),due:parse($('cDue').value),biz:$('cBiz').checked}),
  {ok:r=>t('set.main.cardSaved',{best:r.best,due:r.due})}));
['goal','rate','planned'].forEach(id=>$(id).onchange=()=>runCommand(()=>setGoalSettings({goal:parseMoney($('goal').value),rate:parse($('rate').value),planned:parseMoney($('planned').value)})));
$('printBtn').onclick=()=>window.print();
}

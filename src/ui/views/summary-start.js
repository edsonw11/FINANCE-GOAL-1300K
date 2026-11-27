/**
 * ui/views/summary-start.js
 * Responsibility: the welcome card of a new user on the Summary: what the app is for and three first
 * steps, each one a button (data-start) that opens the right place. Hidden after the first real record.
 */
import { $ } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { START_STEP, startSteps } from '../../domain/start-steps.js';
import { openTxForm } from './transaction-form-sheet.js';
import { openImport } from './import-view.js';
import { goTab } from '../navigation.js';
// catalog keys of the title, the description and the button of each step (read at render time)
const STEP={
  [START_STEP.entry]:{title:'sum.start.entryTitle',desc:'sum.start.entryDesc',btn:'sum.start.entryBtn'},
  [START_STEP.import]:{title:'sum.start.importTitle',desc:'sum.start.importDesc',btn:'sum.start.importBtn'},
  [START_STEP.invest]:{title:'sum.start.investTitle',desc:'sum.start.investDesc',btn:'sum.start.investBtn'}};
export function renderStart(){
  const st=startSteps(),el=$('startCard');
  el.hidden=!st.show;if(!st.show){el.innerHTML='';return;}
  el.innerHTML=`<h3 class="m0">${t('sum.start.welcome')}</h3><p class="help">${t('sum.start.intro')}</p>
    <ol class="start-steps">${st.steps.map((s,i)=>`<li class="${s.done?'done':''}"><span class="start-n" aria-hidden="true">${s.done?'✓':i+1}</span><span class="start-t"><b>${t(STEP[s.code].title)}</b><span class="help m0">${t(STEP[s.code].desc)}</span></span>${s.done?'':`<button type="button" class="btn sm${i===0?' pri':''}" data-start="${s.code}">${t(STEP[s.code].btn)}</button>`}</li>`).join('')}</ol>`;
}
export function bindStart(){
  $('startCard').onclick=e=>{const b=e.target.closest('[data-start]');if(!b)return;
    if(b.dataset.start===START_STEP.entry)openTxForm({type:'despesa'});
    else if(b.dataset.start===START_STEP.import)openImport();
    else goTab('inv');};
}

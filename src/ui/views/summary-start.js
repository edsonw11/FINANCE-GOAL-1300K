/**
 * ui/views/summary-start.js
 * Responsibility: the welcome card of a new user on the Summary: what the app is for and three first
 * steps, each one a button (data-start) that opens the right place. Hidden after the first real record.
 */
import { $ } from '../../core/dom.js';
import { START_STEP, startSteps } from '../../domain/start-steps.js';
import { openTxForm } from './transaction-form-sheet.js';
import { openImport } from './import-view.js';
import { goTab } from '../navigation.js';
const STEP={
  [START_STEP.entry]:{t:'Lance sua primeira despesa ou receita',d:'Leva poucos segundos: valor, categoria e pronto.',b:'Lançar agora'},
  [START_STEP.import]:{t:'Ou importe o extrato do banco',d:'CSV, OFX ou PDF. Você confere tudo antes de gravar.',b:'Importar extrato'},
  [START_STEP.invest]:{t:'Cadastre onde está seu dinheiro investido',d:'Para acompanhar o patrimônio e a sua meta.',b:'Ir para Patrimônio'}};
export function renderStart(){
  const st=startSteps(),el=$('startCard');
  el.hidden=!st.show;if(!st.show){el.innerHTML='';return;}
  el.innerHTML=`<h3 class="m0">👋 Bem-vindo!</h3><p class="help">Aqui você vê quanto entrou, quanto saiu e para onde foi o seu dinheiro, mês a mês. Comece por um destes passos:</p>
    <ol class="start-steps">${st.steps.map((s,i)=>`<li class="${s.done?'done':''}"><span class="start-n" aria-hidden="true">${s.done?'✓':i+1}</span><span class="start-t"><b>${STEP[s.code].t}</b><span class="help m0">${STEP[s.code].d}</span></span>${s.done?'':`<button type="button" class="btn sm${i===0?' pri':''}" data-start="${s.code}">${STEP[s.code].b}</button>`}</li>`).join('')}</ol>`;
}
export function bindStart(){
  $('startCard').onclick=e=>{const b=e.target.closest('[data-start]');if(!b)return;
    if(b.dataset.start===START_STEP.entry)openTxForm({type:'despesa'});
    else if(b.dataset.start===START_STEP.import)openImport();
    else goTab('inv');};
}

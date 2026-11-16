/**
 * ui/views/settings-demo.js
 * Responsibility: Settings: test data (generate and remove).
 */
import { $ } from '../../core/dom.js';
import { S } from '../../domain/store.js';
import { addDemoData, hasDemoData, removeDemoData } from '../../domain/demo-data.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
export function renderDemo(){const n=S.tx.filter(t=>t.demo).length;$('demoN').textContent=n?n+' lançamentos de teste no app':'';$('demoOff').disabled=!n;}
export const generateDemoData=async()=>{
  if(hasDemoData()&&!await askConfirm({title:'Dados de teste',text:'Já existem dados de teste. Substituir por novos?',ok:'Substituir'}))return;
  runCommand(addDemoData,{ok:n=>'🧪 '+n+' lançamentos de teste criados. Veja o gráfico no Resumo.'});};
export function bindDemo(){
$('demoOn').onclick=generateDemoData;
$('demoOff').onclick=async()=>{const n=S.tx.filter(t=>t.demo).length;if(!n||!await askConfirm({title:'Remover dados de teste',text:'Remover os '+n+' lançamentos de teste? Seus lançamentos reais ficam.',ok:'Remover',danger:true}))return;
  runCommand(removeDemoData,{ok:'Dados de teste removidos'});};
}

/**
 * ui/views/settings-demo.js
 * Responsibility: Settings: test data (generate and remove).
 */
import { $ } from '../../core/dom.js';
import { S } from '../../domain/store.js';
import { addDemoData, hasDemoData, removeDemoData } from '../../domain/demo-data.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
export function renderDemo(){const n=S.tx.filter(t=>t.demo).length,tr=(S.trades||[]).filter(t=>t.demo).length;$('demoN').textContent=n?n+' lançamentos e '+tr+' negócios de teste no app':'';$('demoOff').disabled=!hasDemoData();}
export const generateDemoData=async()=>{
  if(hasDemoData()&&!await askConfirm({title:'Dados de teste',text:'Já existem dados de teste. Substituir por novos?',ok:'Substituir'}))return;
  runCommand(addDemoData,{ok:n=>'🧪 '+n+' lançamentos de teste criados (gastos, receitas, aportes, cartão e carteira).'});};
export function bindDemo(){
$('demoOn').onclick=generateDemoData;
$('demoOff').onclick=async()=>{if(!hasDemoData()||!await askConfirm({title:'Remover dados de teste',text:'Remover todos os dados de teste (lançamentos, aportes, negócios da carteira e contas criadas por eles)? O que você lançou de verdade fica.',ok:'Remover',danger:true}))return;
  runCommand(removeDemoData,{ok:'Dados de teste removidos'});};
}

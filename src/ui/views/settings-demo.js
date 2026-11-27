/**
 * ui/views/settings-demo.js
 * Responsibility: Settings: test data (generate and remove).
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
import { S } from '../../domain/store.js';
import { addDemoData, hasDemoData, removeDemoData } from '../../domain/demo-data.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
export function renderDemo(){const n=S.tx.filter(t=>t.demo).length,tr=(S.trades||[]).filter(t=>t.demo).length;$('demoN').textContent=n?t('set.demo.count',{tx:n,trades:tr}):'';$('demoOff').disabled=!hasDemoData();}
export const generateDemoData=async()=>{
  if(hasDemoData()&&!await askConfirm({title:t('set.demo.title'),text:t('set.demo.replaceText'),ok:t('set.demo.replace')}))return;
  runCommand(addDemoData,{ok:n=>t('set.demo.created',{n})});};
export function bindDemo(){
$('demoOn').onclick=generateDemoData;
$('demoOff').onclick=async()=>{if(!hasDemoData()||!await askConfirm({title:t('set.demo.removeTitle'),text:t('set.demo.removeText'),ok:t('set.demo.remove'),danger:true}))return;
  runCommand(removeDemoData,{ok:t('set.demo.removed')});};
}

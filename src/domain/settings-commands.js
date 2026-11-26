/**
 * domain/settings-commands.js
 * Responsibility: commands for the goal assumptions, the card settings and the backup
 * (import converts old backups; it returns the new state and does not apply it).
 */
import { monthEnd } from '../core/dates.js';
import { roundMoney } from '../core/money.js';
import { repairIdCounter } from '../core/id-counter.js';
import { S, seed, autoBackup, replaceState } from './store.js';
import { CARD, ruleClosing } from './card-cycle.js';
const DEFAULT_GOAL=1300000;
export function setGoalSettings({goal,rate,planned}){S.goal=goal>0?goal:DEFAULT_GOAL;S.rate=rate>0?rate:0;S.planned=planned>0?roundMoney(planned):0;}
export function setPlannedContribution(v){S.planned=Math.round(v);}
const clampDay=(v,def)=>Math.min(Math.max(Math.round(v)||def,1),31);
export function setCardSettings({best,due,biz}){
  S.card={best:clampDay(best,1),due:clampDay(due,7),biz:!!biz,over:CARD().over||{},v3:true};
  return {best:S.card.best,due:S.card.due,biz:S.card.biz};
}
// a different closing date for one invoice; equal to the rule means "no override"
export function setClosingOverride(fm,date){const c=CARD();c.over=c.over||{};if(date&&date!==ruleClosing(fm))c.over[fm]=date;else delete c.over[fm];S.card=c;}
export function importBackup(d){
  if(d&&d.v===2&&Array.isArray(d.tx))return {state:repairIdCounter(d),converted:false};
  if(!d||!d.entries)return {error:'Arquivo inválido'};
  // old format (goal tracker): month entries with balances and contributions per account
  const n=seed();n.goal=d.goal||n.goal;n.rate=d.rate||n.rate;n.planned=d.planned||0;n.snaps=[];n.tx=[];
  Object.keys(d.entries).sort().forEach(k=>{const e=d.entries[k];
    e.bal.forEach((v,i)=>{if(n.accounts[i])n.snaps.push({date:monthEnd(k),acc:n.accounts[i].id,value:v,est:!!e.est});});
    e.ap.forEach((v,i)=>{if(v>0&&n.accounts[i])n.tx.push({id:n.nid++,date:k+'-15',type:'aporte',acc:n.accounts[i].id,value:v,desc:'importado'});});});
  return {state:n,converted:true};
}

// puts back the automatic copy of the day before (kept by the store); {error} when there is none
export function restoreAutoBackup(){
  const b=autoBackup();
  if(!b)return {error:'Ainda não existe cópia automática'};
  replaceState(b.state);return {day:b.day};
}

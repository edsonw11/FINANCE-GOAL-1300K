/**
 * domain/allocation.js
 * Responsibility: the optional allocation target: the share (%) the user wants in each type of
 * investment (fixed income, stocks, FIIs...), and how far the portfolio is from it today.
 * Command: setTarget. Read: allocationStatus. Never moves money; it only says the difference.
 */
import { roundMoney } from '../core/money.js';
import { S } from './store.js';
import { ASSET_LABEL } from './ticker-class.js';
import { investmentDistribution, TYPE_ORDER, DIST_FIXED_ID } from './investments.js';
export const TARGET_TOLERANCE=0.02; // within 2 points of the target counts as on target
export const targetOf=id=>((S.targets||{})[id])||0;
// pct: 0 to 100; 0 or empty removes the target. All targets together cannot pass 100%.
export function setTarget(id,pct){
  if(!TYPE_ORDER.includes(id))return {error:'Tipo de investimento desconhecido'};
  const v=Math.round((+pct||0)*10)/10;
  if(v<0||v>100)return {error:'A meta de cada tipo fica entre 0% e 100%'};
  const others=Object.entries(S.targets||{}).filter(([k])=>k!==id).reduce((t,[,x])=>t+x,0);
  if(others+v>100.0001)return {error:'As metas somam '+Math.round((others+v)*10)/10+'%: o total não pode passar de 100%'};
  S.targets=S.targets||{};
  if(v===0)delete S.targets[id];else S.targets[id]=v;
  return {id,value:v};
}
export const clearTargets=()=>{S.targets={};return {};};
// {rows:[{id,name,value,share,target,gap,money,level}], total, targeted}
// gap = share - target (points, as a fraction); money = what to add (+) or reduce (-) to reach the target at today's total
export function allocationStatus(day){
  const d=investmentDistribution(day,'type'),byId={};d.items.forEach(i=>{byId[i.id]=i;});
  const targeted=Object.keys(S.targets||{}).length>0;
  const rows=TYPE_ORDER.filter(id=>byId[id]||targetOf(id)>0).map(id=>{
    const it=byId[id]||{name:id===DIST_FIXED_ID?'Renda fixa e outros':ASSET_LABEL[id],value:0,share:0},t=targetOf(id)/100,gap=it.share-t;
    return {id,name:it.name,value:it.value,share:it.share,target:t,gap,
      money:roundMoney(t*d.total-it.value),level:!t?'none':Math.abs(gap)<=TARGET_TOLERANCE?'on':gap>0?'over':'under'};});
  return {rows,total:d.total,targeted};
}

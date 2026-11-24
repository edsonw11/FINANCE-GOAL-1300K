/**
 * domain/goal-projection.js
 * Responsibility: month by month projection of the net worth toward the goal: compound interest on
 * the balance of the month before plus the planned contribution, and the same plan with a lower
 * rate ("se juros caírem"). Feeds both the single Patrimônio chart and the collapsed table.
 */
import { mIdx, mKey } from '../core/dates.js';
import { S } from './store.js';
export const LOWER_RATE_GAP=2; // percentage points below the assumed rate
const monthlyRate=annual=>Math.pow(1+annual/100,1/12)-1;
export const lowerRate=()=>Math.max(S.rate-LOWER_RATE_GAP,0);
// rows of the table: about a year, or until a little after the goal (at most 4 years)
export const tableMonths=hit=>Math.min(Math.max(hit>0?hit+3:12,12),48);
// months shown in the chart after today: a year, or up to the goal month when it is within two years
export const chartMonths=hit=>hit>0&&hit<=24?Math.max(hit+1,12):12;
/**
 * start: {m, t} (the last real month). Returns {rate, lowRate, rows:[{m, start, interest,
 * contribution, end, low, reached, first}]}; `first` marks the month the goal is reached.
 */
export function projectionPlan(start,months){
  const goal=S.goal,ap=S.planned,mr=monthlyRate(S.rate),ml=monthlyRate(lowerRate()),rows=[];
  let b=start.t,low=start.t,hitRow=false;
  for(let n=1;n<=months;n++){
    const ini=b,interest=ini*mr;b=ini+interest+ap;low=low*(1+ml)+ap;
    const reached=b>=goal,first=reached&&!hitRow;if(reached)hitRow=true;
    rows.push({m:mKey(mIdx(start.m)+n),start:ini,interest,contribution:ap,end:b,low,reached,first});
  }
  return {rate:mr,lowRate:ml,rows};
}
// chart scale: fits the data; the goal line is drawn only when it is inside the scale
export function chartScale(values,goal){
  const top=Math.max(...values,0)*1.12||1;
  return {max:goal<=top*1.05?Math.max(top,goal*1.06):top,goalInside:goal<=top*1.05};
}

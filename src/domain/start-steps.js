/**
 * domain/start-steps.js
 * Responsibility: the first steps shown to a new user on the Summary: what to do first and what is
 * already done. The card is shown while there is no record at all (with test data the user is already
 * exploring); the steps count only real records.
 */
import { S } from './store.js';
export const realRecords=()=>S.tx.filter(t=>!t.demo).length;
export const START_STEP={entry:'first-entry',import:'import',invest:'investments'};
// {show, steps:[{code, done}]}
export function startSteps(){
  const steps=[
    {code:START_STEP.entry,done:realRecords()>0},
    {code:START_STEP.import,done:(S.imports||[]).length>0},
    {code:START_STEP.invest,done:S.accounts.some(a=>!a.demo&&!a.archived)}];
  return {show:S.tx.length===0,steps};
}

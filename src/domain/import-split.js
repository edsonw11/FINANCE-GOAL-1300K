/**
 * domain/import-split.js
 * Responsibility: dividing one import draft across categories before it is saved. A draft keeps
 * extra parts as splits [{cat, value}] (the same shape the manual form saves); what the parts do not
 * cover stays in the main category of the draft. Pure helpers: they return new lists, the session
 * applies them with patchDraft.
 */
import { roundMoney, sumMoney } from '../core/money.js';
import { IMPORT_TYPE } from './import-classify.js';
// only income and expense have categories to divide (a contribution goes to an account)
export const canSplit=d=>d.type===IMPORT_TYPE.expense||d.type===IMPORT_TYPE.income;
// the parts that count: a category and a value
export const splitParts=d=>canSplit(d)?(d.splits||[]).filter(p=>p.cat&&p.cat.trim()&&p.value>0):[];
// what is left for the main category (negative when the parts are bigger than the value)
export const splitRest=d=>roundMoney((d.value||0)-sumMoney(splitParts(d).map(p=>p.value)));
export const splitAdded=d=>(d.splits||[]).concat([{cat:'',value:0}]);
export const splitChanged=(d,i,patch)=>(d.splits||[]).map((p,k)=>k===i?Object.assign({},p,patch):p);
export const splitRemoved=(d,i)=>(d.splits||[]).filter((p,k)=>k!==i);

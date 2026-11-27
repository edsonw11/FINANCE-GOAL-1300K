/**
 * domain/import-draft.js
 * Responsibility: the intermediate model of an import. A draft is one candidate transaction that the
 * user reviews before anything is saved. Builds drafts from raw entries (sign convention, kind of
 * file, classification, category suggestion, stable key), validates one, and sums a selection.
 * The draft is NOT a transaction: it only becomes one in import-commit.js after the user confirms.
 */
import { normalizeText, textHash } from '../core/text-normalize.js';
import { roundMoney, sumMoney } from '../core/money.js';
import { mOf } from '../core/dates.js';
import { parseBrDate } from '../core/import-values.js';
import { dueMonth } from './card-cycle.js';
import { IMPORT_TYPE, classifyEntry } from './import-classify.js';
import { suggestFromHistory } from './import-history.js';
import { NEW_ACCOUNT, defaultAccount } from './import-account.js';
import { splitParts, splitRest } from './import-split.js';
import { t } from '../core/i18n.js';
export const SAVEABLE=[IMPORT_TYPE.expense,IMPORT_TYPE.income,IMPORT_TYPE.contribution];
export const isSaveable=d=>SAVEABLE.includes(d.type);
const MAX_VALUE=10000000;
// card CSVs/PDFs list purchases as positive numbers; bank statements (and every OFX) use negative for money out
const flowOf=(amount,{format,kind,invert})=>{
  const outIsPositive=(format==='csv'||format==='pdf')&&kind==='card';
  const out=outIsPositive?amount>0:amount<0;
  return (invert?!out:out)?'out':'in';
};
// the key recognises the same row in another import: the bank id when there is one, else date+value+text (+ order among identical rows)
function keyFor(entry,seen,o){
  if(o.format==='ofx'&&entry.id)return 'ofx:'+textHash(o.accountId||'')+':'+entry.id;
  const base=entry.id?'id:'+textHash(entry.id):'row:'+textHash(entry.date+'|'+Math.round(Math.abs(entry.amount)*100)+'|'+normalizeText(entry.desc));
  seen[base]=(seen[base]||0)+1;
  return base+'#'+seen[base];
}
let draftSeq=0;
export const newDraftId=()=>'d'+(++draftSeq);
export function blankDraft(over){
  return {id:newDraftId(),key:'',date:'',desc:'',value:0,type:IMPORT_TYPE.expense,reason:null,cat:'',acc:'',fonte:'caixa',newAcc:'',splits:[],installment:null,createRest:false,flow:'',pair:null,fixPair:false,
    selected:true,flags:[],dup:null,raw:'',line:0,manual:true,...over};
}
// entries: raw entries from a reader. o: {format:'csv'|'ofx', kind:'bank'|'card', invert, accountId, ownNames}
// -> {drafts, dropped} (dropped = balance lines that were left out)
export function buildDrafts(entries,o){
  const seen={},drafts=[];let dropped=0;
  entries.forEach(e=>{
    const flow=flowOf(e.amount,o),cls=classifyEntry(e,flow,o.kind,{ownNames:o.ownNames||[]});
    if(cls.drop){dropped++;return;}
    const value=roundMoney(Math.abs(e.amount));
    const noCat=!SAVEABLE.includes(cls.type)||cls.type===IMPORT_TYPE.contribution;
    const cat=cls.cat||(noCat?'':(suggestFromHistory(e.desc,cls.type)||{}).cat||'');
    drafts.push(blankDraft({key:keyFor(e,seen,o),date:e.date,desc:e.desc,value,type:cls.type,reason:cls.reason,cat,
      acc:cls.type===IMPORT_TYPE.contribution?defaultAccount(e.desc):'',
      fonte:o.kind==='card'&&cls.type===IMPORT_TYPE.expense?'cartao':'caixa',installment:cls.installment,flags:cls.flags.concat(e.flags||[]),
      selected:SAVEABLE.includes(cls.type),flow,raw:e.raw,line:e.line,manual:false}));
  });
  return {drafts,dropped};
}
// what is wrong with a draft that makes it impossible to save; [] = can be saved
export function draftProblems(d){
  const p=[];
  if(!SAVEABLE.includes(d.type))p.push(t('imp.draft.pickType'));
  if(d.type===IMPORT_TYPE.contribution&&!d.acc)p.push(t('imp.draft.pickAccount'));
  if(d.type===IMPORT_TYPE.contribution&&d.acc===NEW_ACCOUNT&&!(d.newAcc||'').trim())p.push(t('imp.draft.newAccountName'));
  if(!(d.value>0)||d.value>MAX_VALUE)p.push(t('imp.draft.badValue'));
  if(parseBrDate(d.date)!==d.date)p.push(t('imp.draft.badDate')); // a real calendar day, ISO
  if(splitParts(d).length&&splitRest(d)<0)p.push(t('imp.draft.splitTooBig'));
  return p;
}
// worth a second look: any flag, or no category (it would go to the default category)
export const needsReview=d=>isSaveable(d)&&(d.flags.length>0||(!d.cat&&d.type!==IMPORT_TYPE.contribution));
// the month the app counts the record in (always the month of its date, as for a manual entry)
export const targetMonth=d=>d.date?mOf(d.date):'';
// card purchases also belong to an invoice: the month it is due ('' for anything else)
export const invoiceMonth=d=>d.date&&d.fonte==='cartao'&&d.type===IMPORT_TYPE.expense?dueMonth(d.date):'';
// totals of the drafts that would be saved: {count, income, expense, months:[...]}
export function selectionSummary(drafts){
  const sel=drafts.filter(d=>d.selected&&isSaveable(d)&&!draftProblems(d).length);
  return {count:sel.length,
    income:sumMoney(sel.filter(d=>d.type===IMPORT_TYPE.income).map(d=>d.value)),
    expense:sumMoney(sel.filter(d=>d.type===IMPORT_TYPE.expense).map(d=>d.value)),
    contribution:sumMoney(sel.filter(d=>d.type===IMPORT_TYPE.contribution).map(d=>d.value)),
    months:[...new Set(sel.map(targetMonth))].sort()};
}
// transfers between own accounts that confirming will keep (not the ones already kept by an earlier import)
export const keptTransfers=drafts=>drafts.filter(d=>d.type===IMPORT_TYPE.ownTransfer&&!(d.dup&&d.dup.level==='confirmed')&&d.date&&d.value>0);
// lines left out of the totals because they look like a transfer of the person's own money, but that the person must look at (Q5)
export const possibleTransfers=drafts=>drafts.filter(d=>d.type===IMPORT_TYPE.ignore&&d.flags.includes('possible-transfer'));
// what the review screen shows on top (a preview: nothing here is saved)
export function importOverview(drafts){
  const sel=selectionSummary(drafts),saveable=drafts.filter(isSaveable);
  return {total:drafts.length,
    incomes:saveable.filter(d=>d.type===IMPORT_TYPE.income).length,
    expenses:saveable.filter(d=>d.type===IMPORT_TYPE.expense).length,
    others:drafts.length-saveable.length-drafts.filter(d=>d.type===IMPORT_TYPE.ownTransfer).length,
    transfers:keptTransfers(drafts).length,
    transferTotal:sumMoney(keptTransfers(drafts).map(d=>d.value)),
    pairFixes:keptTransfers(drafts).filter(d=>d.fixPair&&d.pair).length,
    incomeTotal:sumMoney(saveable.filter(d=>d.type===IMPORT_TYPE.income).map(d=>d.value)),
    contributions:saveable.filter(d=>d.type===IMPORT_TYPE.contribution).length,
    contributionTotal:sumMoney(saveable.filter(d=>d.type===IMPORT_TYPE.contribution).map(d=>d.value)),
    expenseTotal:sumMoney(saveable.filter(d=>d.type===IMPORT_TYPE.expense).map(d=>d.value)),
    possibleTransfers:possibleTransfers(drafts).length,
    review:saveable.filter(d=>needsReview(d)||draftProblems(d).length).length+possibleTransfers(drafts).length,
    confirmedDup:drafts.filter(d=>d.dup&&d.dup.level==='confirmed').length,
    possibleDup:drafts.filter(d=>d.dup&&d.dup.level==='possible').length,
    months:[...new Set(saveable.map(targetMonth).filter(Boolean))].sort(),
    selected:sel};
}

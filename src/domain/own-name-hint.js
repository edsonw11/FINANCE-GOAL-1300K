/**
 * domain/own-name-hint.js
 * Responsibility: while reviewing a bank statement, finds the account holder's name when the user did
 * not tell it yet: a salary is paid to the holder ("TED CONTA SALARIO MARIA SOUZA LIMA"). If that name
 * also appears in other lines (Pix to yourself), the review can offer to save it, so those lines become
 * transfers between your own accounts instead of expenses and income.
 */
import { normalizeText } from '../core/text-normalize.js';
import { roundMoney } from '../core/money.js';
import { mentionsOwnName, ownNames } from './own-names.js';
const SALARY_TO=/\bconta salario\s+([a-z ]+)$/;
const MIN_WORDS=2;
const titleCase=s=>s.split(' ').map(w=>w.length<=3&&/^(da|de|do|das|dos|e)$/.test(w)?w:w[0].toUpperCase()+w.slice(1)).join(' ');
const HINT_TYPES=new Set(['despesa','receita']);
// drafts of one statement -> null | {name, count, total} (lines that would stop counting as income/expense)
export function ownNameHint(drafts){
  let name=null,salaryDesc='';
  drafts.some(d=>{const m=normalizeText(d.desc).match(SALARY_TO);
    if(m&&m[1].trim().split(' ').length>=MIN_WORDS){name=titleCase(m[1].trim());salaryDesc=d.desc;return true;}return false;});
  if(!name||mentionsOwnName(salaryDesc,ownNames()))return null;
  const hits=drafts.filter(d=>HINT_TYPES.has(d.type)&&d.desc!==salaryDesc&&!SALARY_TO.test(normalizeText(d.desc))&&mentionsOwnName(d.desc,[name]));
  return hits.length?{name,count:hits.length,total:roundMoney(hits.reduce((a,d)=>a+d.value,0))}:null;
}

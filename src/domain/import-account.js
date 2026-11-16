/**
 * domain/import-account.js
 * Responsibility: suggests the investment account that a statement line refers to. Only answers
 * when exactly one active account matches the words of the description; otherwise the user chooses.
 */
import { S } from './store.js';
import { active } from './accounts.js';
import { normalizeText } from '../core/text-normalize.js';
// -> account id, or '' when none or more than one account fits
export function suggestAccount(desc){
  const text=' '+normalizeText(desc)+' ';
  // every word of the account name (numbers included: "2028" tells two bonds apart) must appear in the text
  const hits=active().filter(a=>{
    const words=normalizeText(a.name).split(' ').filter(w=>w.length>=2);
    return words.length>0&&words.every(w=>text.includes(' '+w+' '));
  });
  return hits.length===1?hits[0].id:'';
}
export const hasAccounts=()=>S.accounts.some(a=>!a.archived);

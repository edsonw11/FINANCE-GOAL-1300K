/**
 * domain/import-account.js
 * Responsibility: suggests the investment account that a statement line refers to. Only answers
 * when exactly one active account matches the words of the description; otherwise the user chooses.
 * With no investment account yet, the default choice is a new account (created only when the import
 * is confirmed, see import-commit.js).
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
// the draft goes to an account that does not exist yet: d.acc = NEW_ACCOUNT, d.newAcc = its name
export const NEW_ACCOUNT='__new';
// account of a contribution draft: the suggested one, or a new account when there is none to choose
export const defaultAccount=desc=>suggestAccount(desc)||(hasAccounts()?'':NEW_ACCOUNT);
// active account with this name (any case), so confirming twice does not create two accounts
export const accountNamed=name=>{const n=normalizeText(name||'');return n?(active().find(a=>normalizeText(a.name)===n)||null):null;};

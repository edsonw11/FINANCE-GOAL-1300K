/**
 * domain/import-custody.js
 * Responsibility: a broker "custody statement" is a snapshot of a balance, not a list of movements.
 * Recognises it in the text of a PDF, reads its date and totals (gross, IR, IOF, net), and applies it as
 * a balance snapshot of one investment account. Saving the same statement again replaces the same day
 * (nothing is duplicated). It never creates contributions, income or expenses.
 */
import { displayName } from '../core/stored-names.js';
import { parseAmount, parseBrDate } from '../core/import-values.js';
import { normalizeText, stripAccents } from '../core/text-normalize.js';
import { roundMoney } from '../core/money.js';
import { t } from '../core/i18n.js';
import { S } from './store.js';
import { balance } from './accounts.js';
import { addAccount, saveSnapshots } from './account-commands.js';
const MONEY_RE='(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';
const CUSTODY_TOTAL_ROW=new RegExp('total geral\\s+'+MONEY_RE+'\\s+'+MONEY_RE+'\\s+'+MONEY_RE+'\\s+'+MONEY_RE);
const CUSTODY_DATE_ROW=/custodia em:?\s*(\d{2}\/\d{2}\/\d{4})/;
// who issued the statement (by the names printed on it) and the first kind of investment of the summary,
// to suggest the account name ("Nubank Caixinhas") when the user has no account for it yet
/** @type {[RegExp, string][]} */
const BROKERS=[[/\bnu investimentos\b|\bnubank\b|\bnu pagamentos\b/,'Nubank'],[/\bxp investimentos\b/,'XP'],[/\bbanco inter\b|\binter dtvm\b/,'Inter'],
  [/\bbtg pactual\b/,'BTG'],[/\brico\b/,'Rico'],[/\bclear corretora\b/,'Clear'],[/\bitau\b/,'Itaú'],[/\bbradesco\b/,'Bradesco'],[/\bsantander\b/,'Santander']];
const FIRST_KIND=/saldo liquido \(r\$\)\s+([a-z][a-z ]{2,30}?)\s+\d/;
const DEFAULT_NAME='Investimentos';
const capital=w=>w.charAt(0).toUpperCase()+w.slice(1);
export function custodyAccountName(n){
  const b=BROKERS.find(([re])=>re.test(n)),k=n.match(FIRST_KIND);
  const kind=k&&!/^total\b/.test(k[1])?k[1].trim().split(' ').map(capital).join(' '):'';
  return [b?b[1]:'',kind].filter(Boolean).join(' ')||displayName(DEFAULT_NAME);
}
export const looksLikeCustody=text=>/extrato de custodia/.test(normalizeText(text));
// -> null (not a custody statement) | {date, gross, ir, iof, net, name (suggested account)} | {error}
export function parseCustody(text){
  if(!looksLikeCustody(text))return null;
  // keeps digits and punctuation (amounts and dates are matched on it); the column marks of the PDF reader
  // (" | ") are only spacing here
  const n=stripAccents(text).toLowerCase().replace(/\s*\|\s*/g,' ').replace(/\s+/g,' ');
  const d=n.match(CUSTODY_DATE_ROW),tot=n.match(CUSTODY_TOTAL_ROW);
  const date=d?parseBrDate(d[1]):null;
  if(!date)return {error:t('imp.custody.noDate')};
  if(!tot)return {error:t('imp.custody.noTotal')};
  const [gross,ir,iof,net]=tot.slice(1,5).map(parseAmount);
  return {date,gross,ir,iof,net,name:custodyAccountName(n)};
}
// c: parsed custody, acc: account id -> {error} | {acc, date}
export function applyCustody(c,acc){
  if(!c||c.error)return {error:t('imp.custody.invalid')};
  if(!S.accounts.some(a=>a.id===acc&&!a.archived))return {error:t('imp.custody.chooseAccount')};
  if(!(c.net>0))return {error:t('imp.custody.invalidNet')};
  saveSnapshots(c.date,[{acc,value:roundMoney(c.net),gross:roundMoney(c.gross)}]);
  return {acc,date:c.date};
}
// command: creates the investment account (the user had none for it) and applies the statement to it
export function applyCustodyToNewAccount(c,name){
  const a=addAccount(name);if(a.error)return a;
  return applyCustody(c,a.id);
}
// what the app shows today for that account on that day, to compare before saving
export const currentBalance=(acc,date)=>balance(acc,date).v;

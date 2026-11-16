/**
 * domain/import-custody.js
 * Responsibility: a broker "custody statement" is a snapshot of a balance, not a list of movements.
 * Recognises it in the text of a PDF, reads its date and totals (gross, IR, IOF, net), and applies it as
 * a balance snapshot of one investment account. Saving the same statement again replaces the same day
 * (nothing is duplicated). It never creates contributions, income or expenses.
 */
import { parseAmount, parseBrDate } from '../core/import-values.js';
import { normalizeText } from '../core/text-normalize.js';
import { roundMoney } from '../core/money.js';
import { S } from './store.js';
import { balance } from './accounts.js';
import { saveSnapshots } from './account-commands.js';
const MONEY_RE='(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';
const CUSTODY_TOTAL_ROW=new RegExp('total geral\\s+'+MONEY_RE+'\\s+'+MONEY_RE+'\\s+'+MONEY_RE+'\\s+'+MONEY_RE);
const CUSTODY_DATE_ROW=/custodia em:?\s*(\d{2}\/\d{2}\/\d{4})/;
const plain=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const looksLikeCustody=text=>/extrato de custodia/.test(normalizeText(text));
// -> null (not a custody statement) | {date, gross, ir, iof, net} | {error}
export function parseCustody(text){
  if(!looksLikeCustody(text))return null;
  const n=plain(text).replace(/\s+/g,' '); // keeps digits and punctuation: amounts and dates are matched on it
  const d=n.match(CUSTODY_DATE_ROW),t=n.match(CUSTODY_TOTAL_ROW);
  const date=d?parseBrDate(d[1]):null;
  if(!date)return {error:'Reconheci um extrato de custódia, mas não achei a data (“Custódia em”).'};
  if(!t)return {error:'Reconheci um extrato de custódia, mas não achei a linha “Total geral” do resumo da posição.'};
  const [gross,ir,iof,net]=t.slice(1,5).map(parseAmount);
  return {date,gross,ir,iof,net};
}
// c: parsed custody, acc: account id -> {error} | {acc, date}
export function applyCustody(c,acc){
  if(!c||c.error)return {error:'Extrato inválido'};
  if(!S.accounts.some(a=>a.id===acc&&!a.archived))return {error:'Escolha a conta de investimento'};
  if(!(c.net>0))return {error:'Saldo líquido inválido'};
  saveSnapshots(c.date,[{acc,value:roundMoney(c.net),gross:roundMoney(c.gross)}]);
  return {acc,date:c.date};
}
// what the app shows today for that account on that day, to compare before saving
export const currentBalance=(acc,date)=>balance(acc,date).v;

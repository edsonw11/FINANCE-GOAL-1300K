/**
 * domain/saved-transfers.js
 * Responsibility: imported records saved before the user told their name: a Pix/TED to or from
 * yourself that was saved as an expense or income. Finds them (salary excluded) and moves them to
 * the transfers, so they stop counting in the month totals. Only imported records are touched.
 */
import { t } from '../core/i18n.js';
import { normalizeText } from '../core/text-normalize.js';
import { roundMoney } from '../core/money.js';
import { S } from './store.js';
import { mentionsOwnName, ownNames } from './own-names.js';
import { SALARY_WORDS } from './import-classify.js';
import { recordToTransfer } from './transfers.js';
const FIXABLE_TYPES=new Set(['despesa','receita']);
export function savedOwnTransfers(){
  const names=ownNames();if(!names.length)return [];
  return S.tx.filter(t=>t.imp&&FIXABLE_TYPES.has(t.type)&&!SALARY_WORDS.test(normalizeText(t.desc))&&mentionsOwnName(t.desc,names));
}
// command -> {count, total} | {error}
export function convertSavedTransfers(){
  const list=savedOwnTransfers();if(!list.length)return {error:t('tx.saved.none')};
  const total=roundMoney(list.reduce((a,t)=>a+t.value,0));
  list.forEach(t=>recordToTransfer(t.id));
  return {count:list.length,total};
}

/**
 * ui/views/category-confirm.js
 * Responsibility: before saving, asks about a category that does not exist yet ("Mercadoo"):
 * use the closest existing one or create the new one on purpose. A name that only differs in
 * accents or case is replaced by the existing one without asking.
 */
import { t } from '../../core/i18n.js';
import { storedName } from '../../core/stored-names.js';
import { esc } from '../../core/dom.js';
import { matchCategory, newCategories } from '../../domain/category-match.js';
import { askConfirm } from '../components/confirm.js';
async function askNewCategory(m){
  const html=m.suggestion?t('set.catConfirm.htmlSuggest',{name:esc(m.name),suggestion:esc(m.suggestion)}):t('set.catConfirm.htmlCreate',{name:esc(m.name)});
  const r=await askConfirm({title:t('set.catConfirm.title'),html,ok:t('set.catConfirm.create',{name:m.name}),alt:m.suggestion?t('set.catConfirm.use',{name:m.suggestion}):''});
  if(!r)return null;
  return r.alt?m.suggestion:m.name;
}
// accents/case fixed and the categories that would be new; nothing to ask means the list is empty
export function prepareCategories(d){
  if(d.type!=='despesa'&&d.type!=='receita')return {record:d,ask:[]};
  const fix=name=>{const n=storedName((name||'').trim());return n&&(matchCategory(d.type,n).same||n);};
  const record=Object.assign({},d,{cat:fix(d.cat),splits:(d.splits||[]).map(s=>Object.assign({},s,{cat:fix(s.cat)}))});
  return {record,ask:newCategories(d.type,[record.cat].concat(record.splits.map(s=>s.cat)))};
}
// asks about each new category; the record with the chosen names, or null when the user cancelled
export async function confirmCategories(record,ask){
  const chosen={};
  for(const m of ask){const name=await askNewCategory(m);if(name===null)return null;chosen[m.name]=name;}
  const pick=n=>Object.prototype.hasOwnProperty.call(chosen,n)?chosen[n]:n;
  return Object.assign({},record,{cat:record.cat&&pick(record.cat),splits:record.splits.map(s=>Object.assign({},s,{cat:s.cat&&pick(s.cat)}))});
}

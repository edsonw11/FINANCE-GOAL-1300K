/**
 * domain/import-history.js
 * Responsibility: suggests a category and a payment source for a description from what the user
 * already entered (same description first; then the same first brand word, at least twice).
 * Only suggests: the caller decides whether to apply it.
 */
import { descriptionKey } from '../core/text-normalize.js';
import { S } from './store.js';
const MIN_BRAND_LENGTH=4;
function tally(map,t){const e=map[t.cat]||(map[t.cat]={cat:t.cat,n:0,fontes:{}});e.n++;e.fontes[t.fonte||'caixa']=(e.fontes[t.fonte||'caixa']||0)+1;}
const best=map=>Object.values(map).sort((a,b)=>b.n-a.n)[0]||null;
const topKey=o=>Object.keys(o).sort((a,b)=>o[b]-o[a])[0];
// type: 'despesa' | 'receita'. Returns {cat, fonte, count, exact} or null
export function suggestFromHistory(desc,type){
  const key=descriptionKey(desc);if(!key)return null;
  const brand=key.split(' ')[0],exact={},loose={};
  for(const t of S.tx){
    if(t.type!==type||!t.cat)continue;
    const k=descriptionKey(t.desc||'');if(!k)continue;
    if(k===key)tally(exact,t);
    else if(brand.length>=MIN_BRAND_LENGTH&&k.split(' ')[0]===brand)tally(loose,t);
  }
  const e=best(exact);
  if(e)return {cat:e.cat,fonte:topKey(e.fontes),count:e.n,exact:true};
  const l=best(loose);
  return l&&l.n>=2?{cat:l.cat,fonte:topKey(l.fontes),count:l.n,exact:false}:null;
}

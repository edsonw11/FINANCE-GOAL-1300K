/**
 * domain/category-match.js
 * Responsibility: tells whether a typed category already exists and, when it does not, which
 * existing one is the most similar (accents, case and small typos ignored), so a new category
 * is only created on purpose.
 */
import { normalizeText } from '../core/text-normalize.js';
import { S } from './store.js';
const SIMILAR=0.6; // below this the names are different things, no suggestion
function editDistance(a,b){
  let prev=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){const row=[i];
    for(let j=1;j<=b.length;j++)row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=row;}
  return prev[b.length];
}
// 1 = same name, 0 = nothing in common; a name contained in the other counts as close
export function nameSimilarity(a,b){
  const x=normalizeText(a),y=normalizeText(b);if(!x||!y)return 0;if(x===y)return 1;
  const words=y.split(' ');if(words.includes(x)||x.split(' ').includes(y))return 0.8;
  return 1-editDistance(x,y)/Math.max(x.length,y.length);
}
const catalog=type=>((S.cats||{})[type]||[]).map(c=>c.name);
// {name, exists, same: existing name written differently, suggestion: closest existing name}
export function matchCategory(type,name){
  const typed=String(name||'').trim(),names=catalog(type);
  if(!typed||names.includes(typed))return {name:typed,exists:true,same:null,suggestion:null};
  const same=names.find(n=>normalizeText(n)===normalizeText(typed));
  if(same)return {name:typed,exists:true,same,suggestion:null};
  let best=null,score=SIMILAR;
  names.forEach(n=>{const s=nameSimilarity(typed,n);if(s>=score){best=n;score=s;}});
  return {name:typed,exists:false,same:null,suggestion:best};
}
// the categories of a record that would be created now (main category and split parts)
export function newCategories(type,names){
  if(type!=='despesa'&&type!=='receita')return [];
  const seen=new Set();
  return names.map(n=>matchCategory(type,n)).filter(m=>!m.exists&&m.name&&!seen.has(m.name)&&seen.add(m.name));
}

/**
 * domain/own-names.js
 * Responsibility: the names of the person who owns the accounts (as banks print them on statements)
 * and the rule that tells if a statement line mentions that person. A Pix/TED to or from yourself is
 * money changing banks, not income or expense. Commands: addOwnName, removeOwnName.
 */
import { normalizeText } from '../core/text-normalize.js';
import { S } from './store.js';
const PARTICLES=new Set(['da','de','do','das','dos','e']);
const MAX_WORDS_BETWEEN=3; // "EDSON B SILVA", "EDSON BATISTA DA SILVA": first and last name close together
export const ownNames=()=>S.ownNames||[];
const nameWords=name=>normalizeText(name).split(' ').filter(w=>w&&!PARTICLES.has(w));
export function addOwnName(name){
  const n=String(name||'').trim().replace(/\s+/g,' ');
  if(nameWords(n).length<2)return {error:'Digite nome e sobrenome, como aparece no extrato (ex.: Maria Souza)'};
  if(ownNames().some(x=>normalizeText(x)===normalizeText(n)))return {error:'Este nome já está na lista'};
  S.ownNames=ownNames().concat([n]);
  return {name:n};
}
export function removeOwnName(name){
  const before=ownNames().length;
  S.ownNames=ownNames().filter(x=>x!==name);
  return before===S.ownNames.length?{error:'Nome não encontrado'}:{name};
}
// the first and the last word of one of the names appear in this order, at most a few words apart
export function mentionsOwnName(desc,names){
  const words=normalizeText(desc).split(' ');
  return (names||[]).some(name=>{
    const w=nameWords(name);if(w.length<2)return false;
    const first=w[0],last=w[w.length-1];
    return words.some((x,i)=>x===first&&words.slice(i+1,i+2+MAX_WORDS_BETWEEN).includes(last));
  });
}

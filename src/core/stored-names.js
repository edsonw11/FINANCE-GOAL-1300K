/**
 * core/stored-names.js
 * Responsibility: names the app stores in Portuguese (default categories, groups, "Cartão (sem detalhe)"...) are SHOWN in the active language
 * and read back to the stored name when a person picks or types them. A name the person created is never touched.
 */
import { t, hasMessage, getLocale, CATALOGS } from './i18n.js';
import { SOURCE_LOCALE } from './locale-resolve.js';
/** catalog key of a stored name: "Imprevistos / Outros" -> "name.imprevistosOutros" */
export function nameKey(name){
  const words=String(name).normalize('NFD').replace(/[̀-ͯ]/g,'').match(/[A-Za-z0-9]+/g)||[];
  return 'name.'+(words[0]||'').toLowerCase()+words.slice(1).map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join('');
}
/** the name in the active language when it is one of the app's own names, otherwise exactly as it is */
export function displayName(name){
  if(name===undefined||name===null)return name;
  const k=nameKey(name);
  return hasMessage(k)&&CATALOGS[SOURCE_LOCALE][k]===name?t(k):name;
}
let cache={locale:null,map:null};
function reverseMap(){
  const locale=getLocale();
  if(cache.locale!==locale){
    const map=new Map();
    Object.keys(CATALOGS[SOURCE_LOCALE]).filter(k=>k.startsWith('name.')).forEach(k=>{
      const stored=CATALOGS[SOURCE_LOCALE][k];
      map.set(String(CATALOGS[locale][k]).toLowerCase(),stored);
      if(!map.has(stored.toLowerCase()))map.set(stored.toLowerCase(),stored); // the Portuguese spelling always works
    });
    cache={locale,map};
  }
  return cache.map;
}
/** the stored name for text shown in (or typed in) the active language; text that is not one of the app's names is returned unchanged */
export function storedName(text){
  const s=String(text===undefined||text===null?'':text);
  const hit=reverseMap().get(s.trim().toLowerCase());
  return hit===undefined?s:hit;
}

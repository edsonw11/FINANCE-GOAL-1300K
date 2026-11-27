/**
 * core/translate.js
 * Responsibility: pure text lookup: finds a key in an ordered list of catalogs, picks the plural form
 * and fills {placeholders}. Holds no state (the active language lives in i18n.js).
 */
/** fillPlaceholders('Hi {name}', {name:'Ana'}) -> 'Hi Ana'; a missing value leaves the {placeholder} visible so the gap is noticed. */
export function fillPlaceholders(text,params){
  return String(text).replace(/\{(\w+)\}/g,(m,k)=>params&&params[k]!==undefined&&params[k]!==null?String(params[k]):m);
}
/** a plural entry is {one,other,...}: the category comes from Intl.PluralRules of the locale; "other" is always the last resort. */
export function pickPlural(entry,count,locale){
  if(typeof entry==='string')return entry;
  const n=Number(count);
  const cat=new Intl.PluralRules(locale).select(Number.isFinite(n)?n:0);
  return entry[cat]!==undefined?entry[cat]:entry.other;
}
/** chain: [{locale, messages}, ...] in order of preference. The first catalog that has the key wins; none: the key itself. */
export function translate(chain,key,params){
  for(const c of chain){
    if(!Object.prototype.hasOwnProperty.call(c.messages,key))continue;
    const entry=c.messages[key];
    return fillPlaceholders(pickPlural(entry,params&&params.count,c.locale),params);
  }
  return key;
}

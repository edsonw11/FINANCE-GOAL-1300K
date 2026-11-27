/**
 * core/i18n.js
 * Responsibility: the active language and t(key, params). The catalogs are registered here once;
 * a key missing in the active language falls back to the source language, then to the key itself.
 */
import { SUPPORTED_LOCALES, SOURCE_LOCALE } from './locale-resolve.js';
import { MESSAGES_PT_BR } from './locale-pt-BR.js';
import { MESSAGES_EN_US } from './locale-en-US.js';
import { MESSAGES_ES } from './locale-es.js';
import { translate } from './translate.js';
export const CATALOGS={'pt-BR':MESSAGES_PT_BR,'en-US':MESSAGES_EN_US,'es':MESSAGES_ES};
let activeLocale=SOURCE_LOCALE;
export const getLocale=()=>activeLocale;
/** setLocale('en-US') -> true; an unsupported locale is refused (false) and the active one stays. */
export function setLocale(locale){
  if(!SUPPORTED_LOCALES.includes(locale))return false;
  activeLocale=locale;return true;
}
export function t(key,params){
  const chain=[{locale:activeLocale,messages:CATALOGS[activeLocale]}];
  if(activeLocale!==SOURCE_LOCALE)chain.push({locale:SOURCE_LOCALE,messages:CATALOGS[SOURCE_LOCALE]});
  return translate(chain,key,params);
}

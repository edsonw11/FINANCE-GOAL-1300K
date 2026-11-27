/**
 * core/locale-resolve.js
 * Responsibility: which supported locale the app uses: maps device language tags (pt-PT, en-GB, es-MX...)
 * to the three supported locales and applies the user's choice ("auto" follows the device).
 */
export const SUPPORTED_LOCALES=['pt-BR','en-US','es'];
export const SOURCE_LOCALE='pt-BR'; // the language the code base was written in: the last stop before showing a bare key
export const FALLBACK_LOCALE='en-US'; // a device language we do not support
export const AUTO_LANGUAGE='auto';
export const LANGUAGE_CHOICES=[AUTO_LANGUAGE,...SUPPORTED_LOCALES];
// each language is always written in itself, so a user who cannot read the current one can still find theirs
export const LANGUAGE_NAMES={'pt-BR':'Português','en-US':'English','es':'Español'};
const BY_PRIMARY={pt:'pt-BR',en:'en-US',es:'es'};
/** matchLocale('pt-PT') -> 'pt-BR'; null when the tag is empty or not supported. */
export function matchLocale(tag){
  if(typeof tag!=='string')return null;
  const primary=tag.trim().toLowerCase().split(/[-_]/)[0];
  return BY_PRIMARY[primary]||null;
}
/** resolveLocale(choice, deviceLanguages): an explicit choice wins; "auto" (or anything unknown) uses the first supported device language, else English. */
export function resolveLocale(choice,deviceLanguages){
  if(SUPPORTED_LOCALES.includes(choice))return choice;
  const list=Array.isArray(deviceLanguages)?deviceLanguages:[deviceLanguages];
  for(const tag of list){const m=matchLocale(tag);if(m)return m;}
  return FALLBACK_LOCALE;
}

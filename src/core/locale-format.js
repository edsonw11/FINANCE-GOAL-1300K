/**
 * core/locale-format.js
 * Responsibility: numbers, month names and weekdays written in the active language (1.234,56 / 1,234.56),
 * and the decimal separator that typed numbers follow. Pure: reads only the active language.
 */
import { getLocale } from './i18n.js';
/** group separators always on (Spanish does not group 4-digit numbers by default) */
export function formatNumber(v,min,max){
  return Number(v).toLocaleString(getLocale(),{minimumFractionDigits:min,maximumFractionDigits:max===undefined?min:max,useGrouping:/** @type {any} */ ('always')});
}
/** "," in Portuguese and Spanish, "." in English */
export const decimalSeparator=()=>(1.1).toLocaleString(getLocale()).charAt(1);
/** "November 2026" / "novembro de 2026" / "noviembre de 2026" for the month key yyyy-mm */
export function monthYearLabel(y,k){return new Intl.DateTimeFormat(getLocale(),{month:'long',year:'numeric'}).format(new Date(y,k-1,1));}
/** long month name in the active language (k = 1..12) */
export function monthName(k){return new Intl.DateTimeFormat(getLocale(),{month:'long'}).format(new Date(2026,k-1,1));}
/** a date (ISO yyyy-mm-dd) as text in the active language: formatDateText('2026-11-27',{weekday:'long'}) */
export function formatDateText(iso,options){return new Date(iso+'T12:00').toLocaleDateString(getLocale(),options);}

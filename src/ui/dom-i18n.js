/**
 * ui/dom-i18n.js
 * Responsibility: puts the active language into the static HTML: data-i18n (text), data-i18n-title,
 * data-i18n-placeholder and data-i18n-aria-label, plus <html lang>.
 */
import { getLocale, t } from '../core/i18n.js';
const ATTRS=[['data-i18n-title','title'],['data-i18n-placeholder','placeholder'],['data-i18n-aria-label','aria-label']];
export function applyStaticTranslations(root=document){
  document.documentElement.lang=getLocale();
  root.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  ATTRS.forEach(([from,to])=>root.querySelectorAll('['+from+']').forEach(el=>el.setAttribute(to,t(el.getAttribute(from)))));
}

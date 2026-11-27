/**
 * ui/views/language-settings.js
 * Responsibility: the language card in Ajustes and the language at start-up: reads the saved choice, resolves it
 * against the device language and applies it. Choosing a language re-translates the page and redraws the screen.
 */
import { $ } from '../../core/dom.js';
import { t, setLocale, getLocale, CATALOGS } from '../../core/i18n.js';
import { createLanguagePreference } from '../../core/language-preference.js';
import { resolveLocale, matchLocale, AUTO_LANGUAGE, SUPPORTED_LOCALES, LANGUAGE_NAMES } from '../../core/locale-resolve.js';
import { applyStaticTranslations } from '../dom-i18n.js';
const preference=createLanguagePreference(localStorage);
const deviceLanguages=()=>navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];
const nameOf=locale=>LANGUAGE_NAMES[locale]||locale;
function applyChoice(){
  setLocale(resolveLocale(preference.get(),deviceLanguages()));
  applyStaticTranslations();
}
/** called once at start-up, before the first render */
export function initLanguage(){applyChoice();}
export function renderLanguageCard(){
  const sel=$('langSel'),choice=preference.get();
  sel.innerHTML=`<option value="${AUTO_LANGUAGE}">${t('language.auto')}</option>`+
    SUPPORTED_LOCALES.map(l=>`<option value="${l}">${nameOf(l)}</option>`).join('');
  sel.value=choice;
  const device=matchLocale(deviceLanguages()[0]);
  $('langInfo').textContent=(choice===AUTO_LANGUAGE?(device?t('language.device',{language:nameOf(device)})+' · ':''):'')+
    t('language.inUse',{language:nameOf(getLocale())})+' · '+t('language.count',{count:Object.keys(CATALOGS).length});
}
/** onChanged: what to redraw after the language changed (the caller passes render, so this file does not import the renderer) */
export function bindLanguageSettings(onChanged){
  $('langSel').onchange=()=>{
    if(!preference.set($('langSel').value))return;
    applyChoice();onChanged();
  };
}

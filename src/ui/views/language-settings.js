/**
 * ui/views/language-settings.js
 * Responsibility: the language card in Ajustes (one flag button per language plus "automatic") and the language at start-up:
 * reads the saved choice, resolves it against the device language and applies it. Tapping a flag re-translates the page and redraws the screen.
 */
import { $ } from '../../core/dom.js';
import { t, setLocale, getLocale, CATALOGS } from '../../core/i18n.js';
import { createLanguagePreference } from '../../core/language-preference.js';
import { resolveLocale, matchLocale, AUTO_LANGUAGE, LANGUAGE_CHOICES, LANGUAGE_NAMES } from '../../core/locale-resolve.js';
import { applyStaticTranslations } from '../dom-i18n.js';
import { flagSvg } from '../components/flags.js';
const preference=createLanguagePreference(localStorage);
const deviceLanguages=()=>navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];
const nameOf=locale=>LANGUAGE_NAMES[locale]||locale;
const labelOf=choice=>choice===AUTO_LANGUAGE?t('language.autoShort'):nameOf(choice);
function applyChoice(){
  setLocale(resolveLocale(preference.get(),deviceLanguages()));
  applyStaticTranslations();
}
/** called once at start-up, before the first render */
export function initLanguage(){applyChoice();}
export function renderLanguageCard(){
  const choice=preference.get();
  $('langBtns').innerHTML=LANGUAGE_CHOICES.map(c=>
    `<button type="button" class="lang-btn${c===choice?' on':''}" data-lang="${c}" role="radio" aria-checked="${c===choice}" aria-label="${c===AUTO_LANGUAGE?t('language.auto'):nameOf(c)}">`+
    `<span class="lang-flag">${flagSvg(c)}</span><span class="lang-name">${labelOf(c)}</span></button>`).join('');
  const device=matchLocale(deviceLanguages()[0]);
  $('langInfo').textContent=(choice===AUTO_LANGUAGE?(device?t('language.device',{language:nameOf(device)})+' · ':''):'')+
    t('language.inUse',{language:nameOf(getLocale())})+' · '+t('language.count',{count:Object.keys(CATALOGS).length});
}
/** onChanged: what to redraw after the language changed (the caller passes render, so this file does not import the renderer) */
export function bindLanguageSettings(onChanged){
  $('langBtns').onclick=e=>{
    const b=e.target.closest('[data-lang]');
    if(!b||!preference.set(b.dataset.lang))return;
    applyChoice();onChanged();
  };
}

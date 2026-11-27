/**
 * ui/chrome.js
 * Responsibility: Header setup: menu icons, section titles and today's date.
 */
import { $ } from '../core/dom.js';
import { svg } from './icons.js';
import { getLocale } from '../core/i18n.js';
/** today's date in the header, written in the active language */
export function renderToday(){const el=$('todayLbl');if(el)el.textContent=new Date().toLocaleDateString(getLocale(),{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
export function initChrome(){
document.querySelectorAll('nav button').forEach(b=>b.insertAdjacentHTML('afterbegin',svg(b.dataset.i)));
document.querySelectorAll('h2').forEach(h=>h.textContent=h.textContent.replace(/^[^\p{L}]+/u,''));
renderToday();
}

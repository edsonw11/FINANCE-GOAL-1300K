/**
 * core/dom.js
 * Responsibility: DOM access and safe-HTML helpers ($, css, esc).
 */
export const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const $=id=>document.getElementById(id);
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

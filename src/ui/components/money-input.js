/**
 * ui/components/money-input.js
 * Responsibility: R$ amount fields. Only digits can be typed and the last two are the cents
 * ("123456" shows "R$ 1.234,56"); the numeric keypad opens on phones; pasted text is understood.
 * Fields opt in with the data-money attribute (older fields are listed in MONEY_SELECTOR).
 */
import { m2 } from '../../core/format.js';
import { formatMoneyDigits, parseMoney } from '../../core/money.js';
const MONEY_SELECTOR='[data-money],#fVal,#dVal,#goal,#planned,#payVal,[id^="s_"],[id^="g_"],[data-sv],[data-clv]';
const isMoneyField=el=>!!(el&&el.tagName==='INPUT'&&el.matches(MONEY_SELECTOR));
function setMoneyText(el,text){
  el.value=text;
  if(document.activeElement===el){try{el.setSelectionRange(text.length,text.length);}catch(e){}}
}
// sets the mobile keyboard and placeholder; called after every render because fields are re-created
export function prepareMoneyInputs(root){
  (root||document).querySelectorAll(MONEY_SELECTOR).forEach(el=>{
    if(el.tagName!=='INPUT'||el._money)return;el._money=true;
    el.inputMode='numeric';el.autocomplete='off';el.setAttribute('enterkeyhint','done');
    if(!el.placeholder||/0,00|^R\$/.test(el.placeholder))el.placeholder='R$ 0,00';
  });
}
export function bindMoneyInputs(){
  // block letters and punctuation before they reach the field (the comma is not needed)
  document.addEventListener('beforeinput',e=>{
    if(!isMoneyField(e.target))return;
    if(/^insert(Text|ReplacementText)$/.test(e.inputType)&&e.data&&/\D/.test(e.data))e.preventDefault();
  },true);
  // capture phase: runs before the field's own handlers, so they always read the formatted value
  document.addEventListener('input',e=>{if(isMoneyField(e.target))setMoneyText(e.target,formatMoneyDigits(e.target.value));},true);
  document.addEventListener('paste',e=>{
    const el=e.target;if(!isMoneyField(el))return;
    e.preventDefault();
    const v=parseMoney((e.clipboardData||window.clipboardData).getData('text'));
    setMoneyText(el,v>0?m2(v):'');
    el.dispatchEvent(new Event('input',{bubbles:true}));
  },true);
  document.addEventListener('focusin',e=>{
    const el=e.target;if(!isMoneyField(el))return;
    requestAnimationFrame(()=>{try{const n=el.value.length;el.setSelectionRange(n,n);}catch(x){}});
  },true);
  prepareMoneyInputs();
}

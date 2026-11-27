/**
 * ui/components/date-input.js
 * Responsibility: date fields that open the calendar. The visible field shows dd/mm/aaaa and is
 * read-only; a transparent native <input type="date"> on top opens the system date picker
 * (wheel/calendar on phones, calendar pop-up on desktop). The field's .value stays ISO (yyyy-mm-dd),
 * so there is no timezone shift and the rest of the code does not change.
 */
import { t } from '../../core/i18n.js';
import { $ } from '../../core/dom.js';
const _inputValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
const isoDateToBR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):'';
export function datePicker(el,opts){
  if(!el||el._dp)return el;
  opts=opts||{};el._dp=true;
  const init=el.getAttribute('value')||_inputValue.get.call(el);
  const wrap=document.createElement('span');wrap.className='dp';
  el.parentNode.insertBefore(wrap,el);wrap.appendChild(el);
  const nat=document.createElement('input');
  nat.type='date';nat.className='dp-native';nat.min=opts.min||'2000-01-01';nat.max=opts.max||'2100-12-31';
  const lab=el.id&&document.querySelector(`label[for="${el.id}"]`);
  nat.setAttribute('aria-label',t('sys.date.openCalendar',{label:(lab&&lab.textContent.replace('*','').trim())||el.getAttribute('aria-label')||t('sys.date.label')}));
  if(el.required)nat.required=true;
  wrap.appendChild(nat);el._dpNative=nat;
  el.type='text';el.readOnly=true;el.tabIndex=-1;el.classList.add('dp-text');el.placeholder='dd/mm/aaaa';el.setAttribute('aria-hidden','true');
  let iso='';
  const show=()=>{_inputValue.set.call(el,isoDateToBR(iso));wrap.classList.toggle('empty',!iso);};
  Object.defineProperty(el,'value',{configurable:true,
    get(){return iso;},
    set(v){iso=/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'';_inputValue.set.call(nat,iso);show();}});
  el.value=init;
  const sync=()=>{
    const v=_inputValue.get.call(nat);
    if(v===iso)return;
    if(v&&(v<nat.min||v>nat.max)){_inputValue.set.call(nat,iso);return;}
    iso=v;show();
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  nat.addEventListener('input',sync);nat.addEventListener('change',sync);
  const open=()=>{try{nat.showPicker();}catch(e){nat.focus();}};
  nat.addEventListener('click',open);
  el.addEventListener('click',open);           // a click on the <label> also lands here
  return el;
}
export function bindDateFields(){
  ['fDate','dDate','snapDate'].forEach(id=>datePicker($(id)));
}

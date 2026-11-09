/**
 * core/input-masks.js
 * Responsibility: Input masks: R$ amounts and dd/mm/yyyy or mm/yyyy dates in form fields.
 */
const MONEY_SELECTOR='#fVal,#dVal,#goal,#planned,[id^="s_"],[id^="g_"],[data-sv],[data-clv]';
function maskMoney(el){
  const raw=el.value.replace(/[^\d,]/g,'');if(!raw){el.value='';return;}
  const i=raw.indexOf(','),ip=(i<0?raw:raw.slice(0,i)).replace(/^0+(?=\d)/,''),dp=i<0?'':raw.slice(i+1).replace(/,/g,'').slice(0,2);
  el.value='R$ '+(ip||'0').replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(i<0?'':','+dp);}
const _vd=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
function brField(el,kind){            // kind: 'date' (dd/mm/yyyy) or 'month' (mm/yyyy); .value stays ISO internally
  if(el._br)return;el._br=true;
  const iso2br=v=>kind==='date'?(/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):''):(/^\d{4}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):'');
  const br2iso=t=>{if(kind==='date'){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);if(!m)return '';const dt=new Date(+m[3],+m[2]-1,+m[1]);return dt.getFullYear()===+m[3]&&dt.getMonth()===+m[2]-1&&dt.getDate()===+m[1]?m[3]+'-'+m[2]+'-'+m[1]:'';}
    const m=/^(\d{2})\/(\d{4})$/.exec(t);return m&&+m[1]>=1&&+m[1]<=12?m[2]+'-'+m[1]:'';};
  const init=el.getAttribute('value')||_vd.get.call(el);
  el.type='text';el.inputMode='numeric';el.autocomplete='off';el.placeholder=kind==='date'?'dd/mm/aaaa':'mm/aaaa';el.maxLength=kind==='date'?10:7;
  Object.defineProperty(el,'value',{get(){return br2iso(_vd.get.call(el));},set(v){_vd.set.call(el,iso2br(v));},configurable:true});
  _vd.set.call(el,iso2br(init));
  el.addEventListener('input',()=>{const d=_vd.get.call(el).replace(/\D/g,'').slice(0,kind==='date'?8:6);let o=d.slice(0,2);
    if(kind==='date'){if(d.length>2)o+='/'+d.slice(2,4);if(d.length>4)o+='/'+d.slice(4);}else if(d.length>2)o+='/'+d.slice(2);
    _vd.set.call(el,o);});
}
function bindMoneyMasks(){
document.addEventListener('input',e=>{if(e.target.matches&&e.target.matches(MONEY_SELECTOR))maskMoney(e.target);},true);
document.addEventListener('focusout',e=>{const el=e.target;if(el.matches&&el.matches(MONEY_SELECTOR)&&/\d/.test(el.value))el.value=m2(parse(el.value));},true);
}
function bindDateFields(){
['fDate','dDate','snapDate'].forEach(id=>brField(document.getElementById(id),'date'));
brField(document.getElementById('fFm'),'month');
}

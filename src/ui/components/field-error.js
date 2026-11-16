/**
 * ui/components/field-error.js
 * Responsibility: validation messages next to the field, in simple words. The field is marked
 * aria-invalid, gets the focus, and the message disappears as soon as the user changes it.
 */
export function fieldError(el,msg){
  if(!el)return false;
  const host=el.closest('.dp')||el;
  let m=host.nextElementSibling;
  if(!m||!m.classList.contains('ferr')){m=document.createElement('div');m.className='ferr';m.setAttribute('role','alert');host.after(m);}
  m.textContent='⚠️ '+msg;
  el.setAttribute('aria-invalid','true');
  const target=el._dpNative||el;
  const clear=()=>{clearFieldError(el);target.removeEventListener('input',clear);target.removeEventListener('change',clear);};
  target.addEventListener('input',clear);target.addEventListener('change',clear);
  try{target.focus({preventScroll:true});}catch(e){}
  host.scrollIntoView({block:'center',behavior:'smooth'});
  return false;
}
function clearFieldError(el){
  const host=el.closest('.dp')||el,m=host.nextElementSibling;
  if(m&&m.classList.contains('ferr'))m.remove();
  el.removeAttribute('aria-invalid');
}
export function clearFieldErrors(root){(root||document).querySelectorAll('.ferr').forEach(m=>m.remove());
  (root||document).querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));}

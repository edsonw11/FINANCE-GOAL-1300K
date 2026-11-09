/**
 * ui/toast.js
 * Responsibility: Temporary toast message at the bottom of the page.
 */
// ---------- toast ----------
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),3200);}

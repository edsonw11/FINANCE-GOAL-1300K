/**
 * ui/navigation.js
 * Responsibility: Tab and month navigation.
 */
function bindNavigation(){
$('nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('section.tab').forEach(s=>s.classList.toggle('on',s.id==='t-'+b.dataset.t));};
document.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{cur=mKey(mIdx(cur)+ +b.dataset.mv);render();});
}

/**
 * ui/navigation.js
 * Responsibility: tab and month navigation. Top menu on wide screens, bottom bar on phones
 * ("Mais" opens the other tabs). The selected month and filters are kept when switching tabs.
 */
import { t } from '../core/i18n.js';
import { $ } from '../core/dom.js';
import { mIdx, mKey, mOf, today } from '../core/dates.js';
import { ui } from './ui-state.js';
import { svg } from './icons.js';
import { Sheet } from './components/sheet.js';
import { render } from './render.js';
import { sendReportMail } from './views/report-print.js';
const MORE_TABS=['analise','cad','cfg'];
// old tab ids that now live inside another tab: [tab, element to scroll to]
const MOVED_TABS={proj:['meta','projCard'],inv:['meta','invStart']};
export function goTab(t){
  const moved=MOVED_TABS[t];if(moved)t=moved[0];
  document.querySelectorAll('#nav button').forEach(x=>{x.classList.toggle('on',x.dataset.t===t);x.setAttribute('aria-current',x.dataset.t===t?'page':'false');});
  document.querySelectorAll('#bnav button').forEach(x=>{const on=x.dataset.t===t||(x.dataset.t==='more'&&MORE_TABS.includes(t));x.classList.toggle('on',on);x.setAttribute('aria-current',on?'page':'false');});
  document.querySelectorAll('section.tab').forEach(s=>s.classList.toggle('on',s.id==='t-'+t));
  if(isNarrow())render(); // charts take the real width of the tab that just appeared
  const target=moved&&$(moved[1]);target?target.scrollIntoView({block:'start'}):window.scrollTo({top:0});
}
const isNarrow=()=>window.matchMedia('(max-width:720px)').matches;
function moreView(){
  return {render(body){
    const items=[['analise','chart',t('sys.more.analysis'),t('sys.more.analysisSub')],['cad','tag',t('sys.more.categories'),t('sys.more.categoriesSub')],['cfg','sliders',t('sys.more.settings'),t('sys.more.settingsSub')]];
    body.innerHTML='<div class="lst">'+items.map(([k,i,n,d])=>`<div class="li" data-more="${k}" role="button" tabindex="0"><span class="li-ic">${svg(i)}</span><span class="li-main"><span class="li-t">${n}</span><span class="li-s">${d}</span></span><span class="li-v">›</span></div>`).join('')+
      `<div class="li" data-more="print" role="button" tabindex="0"><span class="li-ic">🖨️</span><span class="li-main"><span class="li-t">${t('sys.more.print')}</span></span><span class="li-v">›</span></div>
      <div class="li" data-more="mail" role="button" tabindex="0"><span class="li-ic">✉️</span><span class="li-main"><span class="li-t">${t('sys.more.mail')}</span></span><span class="li-v">›</span></div></div>`;
    body.querySelectorAll('[data-more]').forEach(el=>el.onclick=()=>{Sheet.close();if(el.dataset.more==='print')return window.print();if(el.dataset.more==='mail')return sendReportMail();goTab(el.dataset.more);});
    return {title:t('sys.more.title')};
  }};
}
export function bindNavigation(){
$('todoCard').onclick=e=>{const b=e.target.closest('[data-todo]');if(b)goTab(b.dataset.todo);}; // "O que fazer agora"
document.querySelectorAll('[data-go-tab]').forEach(b=>b.onclick=()=>goTab(b.dataset.goTab));
$('nav').onclick=e=>{const b=e.target.closest('button');if(b)goTab(b.dataset.t);};
$('bnav').onclick=e=>{const b=e.target.closest('button');if(!b)return;b.dataset.t==='more'?Sheet.open(moreView()):goTab(b.dataset.t);};
document.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{ui.cur=mKey(mIdx(ui.cur)+ +b.dataset.mv);render();});
document.querySelectorAll('[data-mtoday]').forEach(b=>b.onclick=()=>{ui.cur=mOf(today());render();});
// swipe left/right on the month name changes the month
document.querySelectorAll('.mnav .m').forEach(el=>{let x0=null;
  el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;},{passive:true});
  el.addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40){ui.cur=mKey(mIdx(ui.cur)+(dx<0?1:-1));render();}});});
// re-draw the charts when the width changes (phone rotation, window resize)
let lastW=window.innerWidth,rt=null;
window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(Math.abs(window.innerWidth-lastW)>40){lastW=window.innerWidth;render();}},200);});
}

/**
 * ui/components/detail-registry.js
 * Responsibility: maps tappable elements to what they open (Open/Closed: a new card registers
 * itself; nothing here changes).
 *   data-kpi="key" [data-m="yyyy-mm"]  -> registerDetail(key, m => view|null)   opens the sheet
 *   data-go="kind" (+ data-* attributes) -> registerLink(kind, el => void)      navigation inside it
 */
import { ui } from '../ui-state.js';
import { Sheet } from './sheet.js';
const DETAIL_VIEWS={},DETAIL_LINKS={};
export function registerDetail(key,factory){DETAIL_VIEWS[key]=factory;}
export function registerLink(kind,handler){DETAIL_LINKS[kind]=handler;}
function openDetail(key,m){const f=DETAIL_VIEWS[key];if(!f)return false;const v=f(m||ui.cur);if(v)Sheet.open(v);return true;}
export function bindDetails(){
  document.addEventListener('click',e=>{
    const k=e.target.closest('[data-kpi]');if(k){openDetail(k.dataset.kpi,k.dataset.m);return;}
    const g=e.target.closest('[data-go]');if(g&&DETAIL_LINKS[g.dataset.go])DETAIL_LINKS[g.dataset.go](g);
  });
}

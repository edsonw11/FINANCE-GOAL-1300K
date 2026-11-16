/**
 * ui/views/kpi.js
 * Responsibility: KPI card component. With a key, the card is tappable (data-kpi) and opens
 * the records behind the number (see summary-details.js).
 */
import { esc } from '../../core/dom.js';
import { EM, svg } from '../icons.js';
export function kpi(cls,ic,k,v,n,extra,key,m){
  const tap=key?` tap" data-kpi="${key}"${m?` data-m="${m}"`:''} role="button" tabindex="0" aria-label="${esc(k.replace(/<[^>]+>/g,''))}: ver detalhes"`:'"';
  return `<div class="card kpi ${cls}${tap}><div class="k"><span class="ic">${EM[ic]?svg(EM[ic]):ic}</span>${k}${key?'<span class="kpi-go" aria-hidden="true">›</span>':''}</div><div class="v">${v}</div><div class="n">${n}</div>${extra||''}</div>`;
}

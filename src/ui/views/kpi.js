/**
 * ui/views/kpi.js
 * Responsibility: KPI card component.
 */
function kpi(cls,ic,k,v,n,extra){return `<div class="card kpi ${cls}"><div class="k"><span class="ic">${EM[ic]?svg(EM[ic]):ic}</span>${k}</div><div class="v">${v}</div><div class="n">${n}</div>${extra||''}</div>`;}

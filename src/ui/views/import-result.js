/**
 * ui/views/import-result.js
 * Responsibility: the screen after confirming: what was registered (and in which months), and, item by
 * item, what was not and why, so nothing is left unclear after a partial failure.
 */
import { esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f2 } from '../../core/format.js';
import { mLabel } from '../../core/dates.js';
export function resultHtml(session){
  const r=session.result,bad=r.items.filter(i=>i.status!=='saved'),byId=new Map(session.snapshot.map(d=>[d.id,d]));
  const line=i=>{const d=byId.get(i.id)||{};return `<div class="li"><span class="li-main"><span class="li-t">${esc(d.desc||t('imp.common.noDescription'))}</span><span class="li-s">${esc(i.reason||'')}</span></span><span class="li-v">${d.value?f2(d.value):''}</span></div>`;};
  const failed=bad.filter(i=>i.status==='failed'),skipped=bad.filter(i=>i.status==='skipped');
  return `<div class="imp-done">${r.saved||!r.transfers?`<div class="imp-ok">${t('imp.result.saved',{count:r.saved})}</div>`:''}
    ${r.months.length?`<p class="help">${t('imp.result.months',{months:r.months.map(m=>'<b>'+esc(mLabel(m))+'</b>').join(', ')})}</p>`:''}
    ${failed.length?`<div class="bd-gh"><span>${t('imp.result.failed',{count:failed.length})}</span></div><div class="lst">${failed.map(line).join('')}</div>`:''}
    ${skipped.length?`<div class="bd-gh"><span>${t('imp.result.skipped',{count:skipped.length})}</span></div><div class="lst">${skipped.map(line).join('')}</div>`:''}
    ${r.transfers?`<p class="help">${t('imp.result.transfers',{count:r.transfers})}${r.fixedPairs?` ${t('imp.result.fixedPairs',{count:r.fixedPairs})}`:''}</p>`:''}
    ${(r.accounts||[]).length?`<p class="help">${t('imp.result.accounts',{names:r.accounts.map(esc).join(', ')})}</p>`:''}
    ${!r.saved&&!bad.length&&!r.transfers?`<p class="help">${t('imp.result.nothing')}</p>`:''}</div>`;
}

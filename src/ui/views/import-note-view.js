/**
 * ui/views/import-note-view.js
 * Responsibility: the review screen of a brokerage note: the trading day, each buy and sell with its
 * ticker and kind of asset (editable), the costs, and what will happen when confirmed. Edits only change the
 * trades held in the session; the domain command saves them after the user confirms.
 */
import { $, esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f2 } from '../../core/format.js';
import { formatDateBR } from '../../core/dates.js';
import { sumMoney } from '../../core/money.js';
import { ASSET_LABEL, ASSET_ORDER, classOfTicker } from '../../domain/ticker-class.js';
import { commitTrades, tradeProblems } from '../../domain/trade-commit.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { Sheet } from '../components/sheet.js';
const tradeTotal=t=>t.gross+(t.side==='C'?t.fees:-t.fees);
const classOptions=t=>ASSET_ORDER.map(c=>`<option value="${c}"${t.cls===c?' selected':''}>${ASSET_LABEL[c]}</option>`).join('');
function rowHtml(tr,i){
  const bad=tradeProblems(tr);
  return `<div class="imp-row sel${bad.length?' rev':''}" data-nt="${i}">
    <div class="imp-main"><div class="imp-top"><span class="tag ${tr.side==='C'?'despesa':'receita'}">${tr.side==='C'?t('imp.note.buy'):t('imp.note.sell')}</span>
      <span class="imp-desc">${esc(tr.ticker||'?')} · ${tr.qty} × ${f2(tr.price)}</span><b class="imp-val ${tr.side==='C'?'apo':'rec'}">${f2(tradeTotal(tr))}</b></div>
      <div class="imp-meta"><input data-nt-f="ticker" value="${esc(tr.ticker)}" placeholder="${t('imp.note.tickerHint')}" aria-label="${t('imp.note.tickerLabel')}" class="nt-ticker">
        <select data-nt-f="cls" aria-label="${t('imp.note.classLabel')}">${classOptions(tr)}</select>
        ${tr.fees?`<span class="mut">${t('imp.note.costs',{value:f2(tr.fees)})}</span>`:''}</div>
      ${bad.length?`<div class="imp-note bad-n">${t('imp.review.fixToImport',{problems:esc(bad[0])})}</div>`:''}</div></div>`;
}
export function noteHtml(s){
  const n=s.note,buys=n.trades.filter(t=>t.side==='C'),sells=n.trades.filter(t=>t.side==='V');
  return `<div class="imp-banner">${t('imp.note.banner',{date:formatDateBR(n.date)})}</div>
    <div class="imp-file"><b>${esc(s.file.name)}</b></div>
    <div class="imp-tiles"><div><span>${t('imp.note.buys')}</span><b class="apo">${buys.length}</b><small>${f2(sumMoney(buys.map(tradeTotal)))}</small></div>
      <div><span>${t('imp.note.sells')}</span><b class="rec">${sells.length}</b><small>${f2(sumMoney(sells.map(tradeTotal)))}</small></div>
      <div><span>${t('imp.note.noteCosts')}</span><b>${f2(n.costs)}</b><small>${t('imp.note.costsIncluded')}</small></div></div>
    <div id="ntList">${n.trades.map(rowHtml).join('')}</div>
    <div class="help">${t('imp.note.help')}</div>`;
}
export function bindNote(s,body,foot){
  const n=s.note;
  const ready=()=>n.trades.length>0&&n.trades.every(t=>!tradeProblems(t).length);
  foot.innerHTML=`<button type="button" class="btn" id="ntCancel">${t('imp.common.cancel')}</button><button type="button" class="btn pri" id="ntGo">${t('imp.note.importNote')}</button>`;
  $('ntGo').disabled=!ready();
  $('ntCancel').onclick=()=>Sheet.close();
  body.onchange=e=>{
    const el=e.target.closest('[data-nt-f]'),row=e.target.closest('[data-nt]');if(!el||!row)return;
    const t=n.trades[+row.dataset.nt];
    if(el.dataset.ntF==='ticker'){t.ticker=el.value.trim().toUpperCase();t.cls=classOfTicker(t.ticker,t.name);}
    else t.cls=el.value;
    Sheet.refresh();
  };
  $('ntGo').onclick=async()=>{
    const buys=n.trades.filter(t=>t.side==='C');
    const yes=await askConfirm({title:t('imp.note.confirmTitle'),ok:t('imp.common.import'),
      html:`<div>${t('imp.note.confirmBody',{date:formatDateBR(n.date),buys:buys.length,total:f2(sumMoney(buys.map(tradeTotal))),sells:n.trades.length-buys.length})}</div><div class="mut mt-10">${t('imp.note.confirmNote')}</div>`});
    if(!yes)return;
    const r=runCommand(()=>commitTrades(n.trades,{date:n.date}),{ok:r=>r.saved?t('imp.note.imported',{count:r.saved}):t('imp.note.alreadyImported')});
    if(r)Sheet.close();
  };
}

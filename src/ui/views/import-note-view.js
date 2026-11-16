/**
 * ui/views/import-note-view.js
 * Responsibility: the review screen of a brokerage note: the trading day, each buy and sell with its
 * ticker and kind of asset (editable), the costs, and what will happen when confirmed. Edits only change the
 * trades held in the session; the domain command saves them after the user confirms.
 */
import { $, esc } from '../../core/dom.js';
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
function rowHtml(t,i){
  const bad=tradeProblems(t);
  return `<div class="imp-row sel${bad.length?' rev':''}" data-nt="${i}">
    <div class="imp-main"><div class="imp-top"><span class="tag ${t.side==='C'?'despesa':'receita'}">${t.side==='C'?'Compra':'Venda'}</span>
      <span class="imp-desc">${esc(t.ticker||'?')} · ${t.qty} × ${f2(t.price)}</span><b class="imp-val ${t.side==='C'?'apo':'rec'}">${f2(tradeTotal(t))}</b></div>
      <div class="imp-meta"><input data-nt-f="ticker" value="${esc(t.ticker)}" placeholder="Código (PETR4)" aria-label="Código do ativo" class="nt-ticker">
        <select data-nt-f="cls" aria-label="Tipo de ativo">${classOptions(t)}</select>
        ${t.fees?`<span class="mut">custos ${f2(t.fees)}</span>`:''}</div>
      ${bad.length?`<div class="imp-note bad-n">⛔ ${esc(bad[0])}: corrija para importar</div>`:''}</div></div>`;
}
export function noteHtml(s){
  const n=s.note,buys=n.trades.filter(t=>t.side==='C'),sells=n.trades.filter(t=>t.side==='V');
  return `<div class="imp-banner">🔎 <b>Nota de corretagem de ${formatDateBR(n.date)}.</b> Nada foi gravado ainda.</div>
    <div class="imp-file"><b>${esc(s.file.name)}</b></div>
    <div class="imp-tiles"><div><span>Compras</span><b class="apo">${buys.length}</b><small>${f2(sumMoney(buys.map(tradeTotal)))}</small></div>
      <div><span>Vendas</span><b class="rec">${sells.length}</b><small>${f2(sumMoney(sells.map(tradeTotal)))}</small></div>
      <div><span>Custos da nota</span><b>${f2(n.costs)}</b><small>já somados no preço médio</small></div></div>
    <div id="ntList">${n.trades.map(rowHtml).join('')}</div>
    <div class="help">Cada <b>compra</b> vira um aporte na conta do tipo do ativo e entra na sua Carteira. Cada <b>venda</b> só reduz a posição: ela não vira receita. Confira o código e o tipo (ação, FII, ETF, BDR).</div>`;
}
export function bindNote(s,body,foot){
  const n=s.note;
  const ready=()=>n.trades.length>0&&n.trades.every(t=>!tradeProblems(t).length);
  foot.innerHTML='<button type="button" class="btn" id="ntCancel">Cancelar</button><button type="button" class="btn pri" id="ntGo">Importar nota</button>';
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
    const yes=await askConfirm({title:'Importar a nota?',ok:'Importar',
      html:`<div>Data: <b>${formatDateBR(n.date)}</b><br>${buys.length} compra(s) viram aporte (<b>${f2(sumMoney(buys.map(tradeTotal)))}</b>)<br>${n.trades.length-buys.length} venda(s) só reduzem a posição</div><div class="mut mt-10">A mesma nota importada de novo não duplica nada.</div>`});
    if(!yes)return;
    const r=runCommand(()=>commitTrades(n.trades,{date:n.date}),{ok:r=>r.saved?`Nota importada: ${r.saved} negócio(s) ✅`:'Esta nota já tinha sido importada'});
    if(r)Sheet.close();
  };
}

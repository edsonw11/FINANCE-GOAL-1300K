/**
 * ui/views/portfolio-view.js
 * Responsibility: the "Carteira" card in Investimentos: assets grouped by kind (stocks, FIIs, ETFs, BDRs),
 * each ticker with quantity, average cost and amount invested, and the share of each group. Read only.
 */
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { t } from '../../core/i18n.js';
import { positions, portfolioGroups, realizedTotal, tradesOf } from '../../domain/portfolio.js';
import { ASSET_ICON, ASSET_LABEL } from '../../domain/ticker-class.js';
const pctRound=x=>Math.round(x*100)+'%';
export function renderPortfolio(){
  const el=$('portfolio');if(!el)return;
  const trades=tradesOf(),groups=portfolioGroups(trades);
  if(!trades.length){el.innerHTML=`<div class="help">${t('sum.portfolio.empty')}</div>`;return;}
  const total=groups.reduce((s,g)=>s+g.cost,0),realized=realizedTotal(trades),over=positions(trades).some(p=>p.oversold);
  el.innerHTML=`<div class="pf-total"><span>${t('sum.portfolio.total')}</span><b>${f2(total)}</b></div>`+
    groups.map(g=>`<div class="pf-group"><div class="pf-head"><b>${ASSET_ICON[g.cls]} ${ASSET_LABEL[g.cls]}</b><span>${pctRound(g.share)} · ${f2(g.cost)}</span></div>
      ${g.items.map(p=>`<div class="pf-row"><b>${esc(p.ticker)}</b><span class="mut">${t('sum.portfolio.row',{qty:p.qty,avg:f2(p.avg)})}</span><span>${f2(p.cost)}</span></div>`).join('')}</div>`).join('')+
    (realized?`<div class="help">${t('sum.portfolio.realized',{cls:realized>=0?'pos':'neg',value:f2(realized)})}</div>`:'')+
    (over?`<div class="bd-note">${t('sum.portfolio.oversold')}</div>`:'')+
    `<div class="help">${t('sum.portfolio.note')}</div>`;
}

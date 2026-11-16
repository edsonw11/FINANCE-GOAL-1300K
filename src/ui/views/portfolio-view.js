/**
 * ui/views/portfolio-view.js
 * Responsibility: the "Carteira" card in Investimentos: assets grouped by kind (stocks, FIIs, ETFs, BDRs),
 * each ticker with quantity, average cost and amount invested, and the share of each group. Read only.
 */
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { positions, portfolioGroups, realizedTotal, tradesOf } from '../../domain/portfolio.js';
import { ASSET_ICON, ASSET_LABEL } from '../../domain/ticker-class.js';
const pctRound=x=>Math.round(x*100)+'%';
export function renderPortfolio(){
  const el=$('portfolio');if(!el)return;
  const trades=tradesOf(),groups=portfolioGroups(trades);
  if(!trades.length){el.innerHTML='<div class="help">Ainda sem ativos. Importe uma <b>nota de corretagem</b> (botão acima) e a carteira aparece aqui, separada em ações, FIIs e ETFs.</div>';return;}
  const total=groups.reduce((s,g)=>s+g.cost,0),realized=realizedTotal(trades),over=positions(trades).some(p=>p.oversold);
  el.innerHTML=`<div class="pf-total"><span>Total investido (com custos)</span><b>${f2(total)}</b></div>`+
    groups.map(g=>`<div class="pf-group"><div class="pf-head"><b>${ASSET_ICON[g.cls]} ${ASSET_LABEL[g.cls]}</b><span>${pctRound(g.share)} · ${f2(g.cost)}</span></div>
      ${g.items.map(p=>`<div class="pf-row"><b>${esc(p.ticker)}</b><span class="mut">${p.qty} un · preço médio ${f2(p.avg)}</span><span>${f2(p.cost)}</span></div>`).join('')}</div>`).join('')+
    (realized?`<div class="help">Resultado das vendas: <b class="${realized>=0?'pos':'neg'}">${f2(realized)}</b> (preço médio, já descontados os custos).</div>`:'')+
    (over?'<div class="bd-note">⚠️ Alguma venda é maior que as compras importadas: falta importar uma nota mais antiga.</div>':'')+
    '<div class="help">Mostra o que você investiu e o preço médio. O valor de mercado de hoje não aparece aqui: atualize o saldo da conta em “Atualizar saldos”.</div>';
}

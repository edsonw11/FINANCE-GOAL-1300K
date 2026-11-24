/**
 * ui/views/report-html.js
 * Responsibility: the words and the layout of the printed report (PDF) of one month, from the numbers of
 * domain/report.js: a one-sentence summary, four big numbers, what needs attention, the goal, where the
 * money went, the last months, the biggest expenses, investments, card, budgets and reserve. Plain
 * language, no jargon, no emojis (they print differently on each computer). Pure text builder: no DOM
 * reads, no events, no state. The look is in styles/11-report.css.
 */
import { esc } from '../../core/dom.js';
import { f0, f2, pc } from '../../core/format.js';
import { formatDateBR, mLabel, mShort } from '../../core/dates.js';
import { BUDGET_LEVEL } from '../../domain/budgets.js';
import { invoiceName } from '../invoice-name.js';
import { LEVEL_TEXT } from './summary-hero.js';
const RP_ATTENTION={
  'invoice-late':a=>a.count>1?`${a.count} faturas de cartão venceram sem pagamento lançado (${rpF2(a.rest)})`:`${invoiceName(a.fm)} venceu e não foi paga (${rpF2(a.rest)})`,
  'invoice-due':a=>`${invoiceName(a.fm)} vence em ${a.days} dia${a.days===1?'':'s'} (${rpF2(a.rest)})`,
  'budget-over':a=>`Passou do limite de gastos em: ${a.groups.map(esc).join(', ')}`,
  'bills-missing':a=>`${a.count} conta${a.count===1?'':'s'} do mês ainda não lançada${a.count===1?'':'s'}`,
  'no-contribution':()=>'Nenhum aporte (dinheiro investido) neste mês ainda',
  'no-reserve':()=>'Falta marcar qual investimento é a sua reserva de emergência'};
const RP_BUDGET_TEXT={[BUDGET_LEVEL.ok]:'Dentro do limite',[BUDGET_LEVEL.near]:'Perto do limite',[BUDGET_LEVEL.over]:'Passou do limite'};
const RP_RESERVE_TEXT={good:'confortável',ok:'razoável',low:'curta'};
// "R$" and the number stay on the same line
const rpF2=v=>f2(v).replace('R$ ','R$\u00a0'),rpF0=v=>f0(v).replace('R$ ','R$\u00a0');
const rpMoney=v=>(v<0?'− ':'')+rpF2(Math.abs(v));
const rpTone=v=>v<0?'neg':'pos';
const rpComma=n=>String(n).replace('.',',');
// "7 meses" / "1 ano e 3 meses"
function rpSpan(n){
  const mo=k=>k+(k===1?' mês':' meses');
  if(n<12)return mo(n);
  const y=Math.floor(n/12),r=n%12;
  return y+(y===1?' ano':' anos')+(r?' e '+mo(r):'');
}
// a horizontal bar drawn as SVG (it prints even when the browser drops background colors)
const rpBar=(share,tone='')=>`<svg class="rp-bar${tone?' rp-'+tone:''}" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect class="rp-track" width="100" height="4"/><rect class="rp-fill" width="${(Math.max(0,Math.min(1,share||0))*100).toFixed(1)}" height="4"/></svg>`;
const rpSection=(title,body,note)=>`<section class="rp-sec"><h2>${title}</h2>${body}${note?`<p class="rp-note">${note}</p>`:''}</section>`;
const rpTile=(k,v,n,tone)=>`<div class="rp-tile"><div class="rp-k">${k}</div><div class="rp-v ${tone||''}">${v}</div><div class="rp-n">${n||'&nbsp;'}</div></div>`;
// ---- parts
function rpHead(r){
  const part=r.current?`Mês em andamento: valores até ${formatDateBR(r.day).slice(0,5)}`:'Mês fechado';
  return `<header class="rp-head"><div><div class="rp-kicker">Relatório financeiro</div><h1>${esc(mLabel(r.m))}</h1></div>
    <div class="rp-meta">${part}<br>Gerado em ${formatDateBR(r.day)}</div></header>`;
}
function rpLead(r){
  const x=r.month,name=mLabel(r.m).toLowerCase();
  if(!r.hasData)return `<p class="rp-lead">Ainda não há lançamentos em ${esc(name)}. Lance suas receitas e despesas (ou importe o extrato) para ver o relatório completo.</p>`;
  const left=x.left>=0?`sobraram <b class="pos">${rpF2(x.left)}</b>${x.rate!==null&&x.left>0?` (${pc(x.rate)} do que entrou)`:''}`:`faltaram <b class="neg">${rpF2(-x.left)}</b>`;
  const invested=x.invested>0?` Você investiu <b>${rpF2(x.invested)}</b> neste mês.`:'';
  return `<p class="rp-lead">${r.current?'Até hoje, em':'Em'} ${esc(name)} você recebeu <b>${rpF2(x.income)}</b>, gastou <b>${rpF2(x.expenses)}</b> e ${left}.${invested}<br><span class="rp-lead-sub">${LEVEL_TEXT[x.level]}</span></p>`;
}
const rpTiles=r=>`<div class="rp-tiles">${rpTile('Entrou',rpF2(r.month.income),'receitas do mês','pos')}${rpTile('Saiu',rpF2(r.month.expenses),'despesas do mês','neg')}
  ${rpTile('Sobrou',rpMoney(r.month.left),r.month.rate!==null?pc(r.month.rate)+' do que entrou':'sem receitas no mês',rpTone(r.month.left))}
  ${rpTile('Patrimônio',rpF2(r.goal.networth),'meta: '+rpF0(r.goal.target))}</div>`;
const rpAttention=r=>r.attention.length?rpSection('Pontos de atenção',`<ul class="rp-attn">${r.attention.map(a=>`<li>${RP_ATTENTION[a.code](a.data)}</li>`).join('')}</ul>`):'';
function rpGoal(r){
  const g=r.goal;
  const pace=`No ritmo atual (aporte de ${rpF0(g.planned)} por mês e rendimento de ${rpComma(g.rate)}% ao ano)`;
  const eta=g.monthsLeft===null?`${pace}, a meta leva <b>mais de 5 anos</b>.`
    :`${pace}, a meta chega em <b>${esc(g.etaMonth?mLabel(g.etaMonth).toLowerCase():'')}</b>, daqui a ${rpSpan(g.monthsLeft)}.`;
  const text=g.reached?`Você tem <b>${rpF2(g.networth)}</b>: <b class="pos">a meta foi atingida.</b>`
    :`Você tem <b>${rpF2(g.networth)}</b>, que é <b>${pc(g.progress)}</b> da meta. Faltam <b>${rpF2(g.remaining)}</b>. ${eta}`;
  const body=`${rpBar(g.progress)}<p class="rp-text">${text}</p>`;
  return rpSection('Meta de '+rpF0(g.target),body,r.current?'':'A previsão parte dos saldos de hoje, não do fim deste mês.');
}
function rpSpending(r){
  if(!r.spending.length)return '';
  const rows=r.spending.map(g=>`<tr><td class="rp-name">${esc(g.name)}</td><td class="rp-barcell">${rpBar(g.share)}</td><td class="rp-num">${rpF2(g.value)}</td><td class="rp-num rp-dim">${pc(g.share)}</td></tr>`).join('');
  const c=r.compare;
  const cmp=c?`<p class="rp-text">${c.delta===0?'Os gastos ficaram iguais aos':`Você gastou <b>${rpF2(Math.abs(c.delta))} ${c.delta>0?'a mais':'a menos'}</b> (${pc(Math.abs(c.pct))}) que`} de ${esc(mLabel(c.m).toLowerCase())}.</p>`:'';
  return rpSection('Para onde foi o dinheiro',`<table class="rp-table">${rows}</table>${cmp}`);
}
function rpTrend(r){
  const rows=r.trend.rows.map((t,i)=>{const open=r.current&&i===r.trend.rows.length-1;
    return `<tr><td class="rp-name">${esc(mShort(t.m))}${open?' <span class="rp-dim">(até hoje)</span>':''}</td><td class="rp-num">${rpF2(t.income)}</td><td class="rp-num">${rpF2(t.expenses)}</td><td class="rp-num ${rpTone(t.left)}">${rpMoney(t.left)}</td></tr>`;}).join('');
  const avg=r.trend.averageLeft===null?'':`<p class="rp-text">Média do que sobrou nos meses fechados: <b class="${rpTone(r.trend.averageLeft)}">${rpMoney(r.trend.averageLeft)}</b> por mês.</p>`;
  return rpSection('Últimos meses',`<table class="rp-table"><tr><th class="rp-name">Mês</th><th class="rp-num">Entrou</th><th class="rp-num">Saiu</th><th class="rp-num">Sobrou</th></tr>${rows}</table>${avg}`);
}
const rpBiggest=r=>r.biggest.length?rpSection('Maiores gastos do mês',`<table class="rp-table">${r.biggest.map(b=>
  `<tr><td class="rp-date">${formatDateBR(b.date).slice(0,5)}</td><td class="rp-name">${esc(b.desc)}${b.desc!==b.cat?` <span class="rp-dim">· ${esc(b.cat)}</span>`:''}</td><td class="rp-num">${rpF2(b.value)}</td></tr>`).join('')}</table>`):'';
const rpInvest=r=>r.investments?rpSection('Onde está o seu dinheiro investido',`<table class="rp-table">${r.investments.items.map(i=>
  `<tr><td class="rp-name">${esc(i.name)}</td><td class="rp-barcell">${rpBar(i.share)}</td><td class="rp-num">${rpF2(i.value)}</td><td class="rp-num rp-dim">${pc(i.share)}</td></tr>`).join('')}</table>
  <p class="rp-text">Total: <b>${rpF2(r.investments.total)}</b></p>`):'';
function rpBudgets(r){
  if(!r.budgets)return '';
  const rows=r.budgets.rows.map(b=>`<tr><td class="rp-name">${esc(b.group)}</td><td class="rp-barcell">${rpBar(b.share,b.level)}</td><td class="rp-num">${rpF2(b.spent)} de ${rpF2(b.budget)}</td><td class="rp-num rp-${b.level}-t">${RP_BUDGET_TEXT[b.level]}</td></tr>`).join('');
  return rpSection('Limites de gastos do mês',`<table class="rp-table">${rows}</table>`);
}
function rpCardReserve(r){
  const lines=[];
  if(r.card)lines.push(`<li><b>${esc(invoiceName(r.card.fm))}:</b> ${rpF2(r.card.rest)} a pagar, vence em ${formatDateBR(r.card.due)}.</li>`);
  const e=r.reserve;
  if(e)lines.push(e.months===null?`<li><b>Reserva de emergência:</b> ${rpF2(e.balance)} (falta histórico de gastos para saber quantos meses ela cobre).</li>`
    :`<li><b>Reserva de emergência:</b> ${rpF2(e.balance)}, o que cobre <b>${rpComma(e.months.toFixed(1))} meses</b> de gastos (meta: ${e.target} meses). Situação ${RP_RESERVE_TEXT[e.level]}.</li>`);
  return lines.length?rpSection('Cartão e reserva',`<ul class="rp-list">${lines.join('')}</ul>`):'';
}
const rpFoot=()=>`<footer class="rp-foot">Como ler: “Entrou” e “Saiu” não incluem transferências entre as suas contas nem o dinheiro aplicado em investimentos. Compras no cartão contam na data da compra. Valores em reais (R$).</footer>`;
// the whole report
export function reportHtml(r){
  return `<article class="rp-page">${rpHead(r)}${rpLead(r)}${r.hasData?rpTiles(r)+rpAttention(r)+rpGoal(r)+rpSpending(r)+rpTrend(r)+rpBiggest(r)+rpInvest(r)+rpBudgets(r)+rpCardReserve(r):''}${rpFoot()}</article>`;
}

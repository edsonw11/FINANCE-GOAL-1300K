/**
 * ui/views/report-html.js
 * Responsibility: the words and the layout of the printed report (PDF) of one month, from the numbers of
 * domain/report.js: a one-sentence summary, four big numbers, what needs attention, the goal, where the
 * money went, the last months, the biggest expenses, investments, card, budgets and reserve. Plain
 * language, no jargon, no emojis (they print differently on each computer). Pure text builder: no DOM
 * reads, no events, no state. The look is in styles/11-report.css.
 */
import { t } from '../../core/i18n.js';
import { displayName } from '../../core/stored-names.js';
import { esc } from '../../core/dom.js';
import { f0, f2, pc } from '../../core/format.js';
import { formatDateBR, mLabel, mShort } from '../../core/dates.js';
import { BUDGET_LEVEL } from '../../domain/budgets.js';
import { invoiceName } from '../invoice-name.js';
import { LEVEL_TEXT } from './summary-hero.js';
const RP_ATTENTION={
  'invoice-late':a=>a.count>1?t('set.reportHtml.lateMany',{count:a.count,rest:rpF2(a.rest)}):t('set.reportText.lateOne',{name:invoiceName(a.fm),rest:rpF2(a.rest)}),
  'invoice-due':a=>t(a.days===1?'set.reportText.dueOne':'set.reportText.dueMany',{name:invoiceName(a.fm),days:a.days,rest:rpF2(a.rest)}),
  'budget-over':a=>t('set.reportText.budgetOver',{groups:a.groups.map(g=>esc(displayName(g))).join(', ')}),
  'bills-missing':a=>t(a.count===1?'set.reportText.billsOne':'set.reportText.billsMany',{count:a.count}),
  'no-contribution':()=>t('set.reportHtml.noContribution'),
  'no-reserve':()=>t('set.reportHtml.noReserve')};
// keys of the status words, resolved when the report is built (the language can change after load)
const RP_BUDGET_TEXT={[BUDGET_LEVEL.ok]:'set.reportHtml.budgetOk',[BUDGET_LEVEL.near]:'set.reportHtml.budgetNear',[BUDGET_LEVEL.over]:'set.reportHtml.budgetOver'};
const RP_RESERVE_TEXT={good:'set.reportHtml.reserveGood',ok:'set.reportHtml.reserveOk',low:'set.reportHtml.reserveLow'};
const RP_LEAD_KEY={PastLeft:'set.reportHtml.leadPastLeft',PastLeftRate:'set.reportHtml.leadPastLeftRate',PastShort:'set.reportHtml.leadPastShort',CurrentLeft:'set.reportHtml.leadCurrentLeft',CurrentLeftRate:'set.reportHtml.leadCurrentLeftRate',CurrentShort:'set.reportHtml.leadCurrentShort'};
// "R$" and the number stay on the same line
const rpF2=v=>f2(v).replace('R$ ','R$\u00a0'),rpF0=v=>f0(v).replace('R$ ','R$\u00a0');
const rpMoney=v=>(v<0?'− ':'')+rpF2(Math.abs(v));
const rpTone=v=>v<0?'neg':'pos';
const rpComma=n=>String(n).replace('.',',');
// "7 meses" / "1 ano e 3 meses"
function rpSpan(n){
  const mo=k=>t(k===1?'set.reportHtml.monthsOne':'set.reportHtml.monthsMany',{n:k});
  if(n<12)return mo(n);
  const y=Math.floor(n/12),r=n%12,yr=t(y===1?'set.reportHtml.yearsOne':'set.reportHtml.yearsMany',{n:y});
  return r?t('set.reportHtml.spanAnd',{years:yr,months:mo(r)}):yr;
}
// a horizontal bar drawn as SVG (it prints even when the browser drops background colors)
const rpBar=(share,tone='')=>`<svg class="rp-bar${tone?' rp-'+tone:''}" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect class="rp-track" width="100" height="4"/><rect class="rp-fill" width="${(Math.max(0,Math.min(1,share||0))*100).toFixed(1)}" height="4"/></svg>`;
const rpSection=(title,body,note)=>`<section class="rp-sec"><h2>${title}</h2>${body}${note?`<p class="rp-note">${note}</p>`:''}</section>`;
const rpTile=(k,v,n,tone)=>`<div class="rp-tile"><div class="rp-k">${k}</div><div class="rp-v ${tone||''}">${v}</div><div class="rp-n">${n||'&nbsp;'}</div></div>`;
// ---- parts
function rpHead(r){
  const part=r.current?t('set.reportHtml.partial',{date:formatDateBR(r.day).slice(0,5)}):t('set.reportHtml.closed');
  return `<header class="rp-head"><div><div class="rp-kicker">${t('set.reportHtml.kicker')}</div><h1>${esc(mLabel(r.m))}</h1></div>
    <div class="rp-meta">${part}<br>${t('set.reportHtml.generated',{date:formatDateBR(r.day)})}</div></header>`;
}
function rpLead(r){
  const x=r.month,name=mLabel(r.m).toLowerCase();
  if(!r.hasData)return `<p class="rp-lead">${t('set.reportHtml.leadEmpty',{month:esc(name)})}</p>`;
  const kind=x.left>=0?(x.rate!==null&&x.left>0?'LeftRate':'Left'):'Short';
  const lead=t(RP_LEAD_KEY[(r.current?'Current':'Past')+kind],{month:esc(name),income:rpF2(x.income),expenses:rpF2(x.expenses),left:rpF2(Math.abs(x.left)),rate:x.rate!==null?pc(x.rate):''});
  const invested=x.invested>0?t('set.reportHtml.invested',{value:rpF2(x.invested)}):'';
  return `<p class="rp-lead">${lead}${invested}<br><span class="rp-lead-sub">${LEVEL_TEXT[x.level]}</span></p>`;
}
const rpTiles=r=>`<div class="rp-tiles">${rpTile(t('set.reportHtml.in'),rpF2(r.month.income),t('set.reportHtml.incomeOfMonth'),'pos')}${rpTile(t('set.reportHtml.out'),rpF2(r.month.expenses),t('set.reportHtml.expensesOfMonth'),'neg')}
  ${rpTile(t('set.reportHtml.left'),rpMoney(r.month.left),r.month.rate!==null?t('set.reportHtml.ofIncome',{rate:pc(r.month.rate)}):t('set.reportHtml.noIncome'),rpTone(r.month.left))}
  ${rpTile(t('set.reportHtml.networth'),rpF2(r.goal.networth),t('set.reportHtml.goalNote',{target:rpF0(r.goal.target)}))}</div>`;
const rpAttention=r=>r.attention.length?rpSection(t('set.reportHtml.attention'),`<ul class="rp-attn">${r.attention.map(a=>`<li>${RP_ATTENTION[a.code](a.data)}</li>`).join('')}</ul>`):'';
function rpGoal(r){
  const g=r.goal;
  const pace={planned:rpF0(g.planned),rate:rpComma(g.rate)};
  const eta=g.monthsLeft===null?t('set.reportHtml.etaFar',pace)
    :t('set.reportHtml.etaDate',{...pace,month:esc(g.etaMonth?mLabel(g.etaMonth).toLowerCase():''),span:rpSpan(g.monthsLeft)});
  const text=g.reached?t('set.reportHtml.goalReached',{networth:rpF2(g.networth)})
    :t('set.reportHtml.goalProgress',{networth:rpF2(g.networth),progress:pc(g.progress),remaining:rpF2(g.remaining),eta});
  const body=`${rpBar(g.progress)}<p class="rp-text">${text}</p>`;
  return rpSection(t('set.reportHtml.goalTitle',{target:rpF0(g.target)}),body,r.current?'':t('set.reportHtml.goalNote2'));
}
function rpSpending(r){
  if(!r.spending.length)return '';
  const rows=r.spending.map(g=>`<tr><td class="rp-name">${esc(displayName(g.name))}</td><td class="rp-barcell">${rpBar(g.share)}</td><td class="rp-num">${rpF2(g.value)}</td><td class="rp-num rp-dim">${pc(g.share)}</td></tr>`).join('');
  const c=r.compare;
  const cmp=c?`<p class="rp-text">${t(c.delta===0?'set.reportHtml.cmpEqual':c.delta>0?'set.reportHtml.cmpMore':'set.reportHtml.cmpLess',{value:rpF2(Math.abs(c.delta)),pct:pc(Math.abs(c.pct)),month:esc(mLabel(c.m).toLowerCase())})}</p>`:'';
  return rpSection(t('set.reportHtml.whereMoneyWent'),`<table class="rp-table">${rows}</table>${cmp}`);
}
function rpTrend(r){
  const rows=r.trend.rows.map((w,i)=>{const open=r.current&&i===r.trend.rows.length-1;
    return `<tr><td class="rp-name">${esc(mShort(w.m))}${open?' <span class="rp-dim">'+t('set.reportHtml.untilToday')+'</span>':''}</td><td class="rp-num">${rpF2(w.income)}</td><td class="rp-num">${rpF2(w.expenses)}</td><td class="rp-num ${rpTone(w.left)}">${rpMoney(w.left)}</td></tr>`;}).join('');
  const avg=r.trend.averageLeft===null?'':`<p class="rp-text">${t('set.reportHtml.avgLeft',{tone:rpTone(r.trend.averageLeft),value:rpMoney(r.trend.averageLeft)})}</p>`;
  return rpSection(t('set.reportHtml.lastMonths'),`<table class="rp-table"><tr><th class="rp-name">${t('set.reportHtml.month')}</th><th class="rp-num">${t('set.reportHtml.in')}</th><th class="rp-num">${t('set.reportHtml.out')}</th><th class="rp-num">${t('set.reportHtml.left')}</th></tr>${rows}</table>${avg}`);
}
const rpBiggest=r=>r.biggest.length?rpSection(t('set.reportHtml.biggest'),`<table class="rp-table">${r.biggest.map(b=>
  `<tr><td class="rp-date">${formatDateBR(b.date).slice(0,5)}</td><td class="rp-name">${esc(b.desc)}${b.desc!==b.cat?` <span class="rp-dim">· ${esc(displayName(b.cat))}</span>`:''}</td><td class="rp-num">${rpF2(b.value)}</td></tr>`).join('')}</table>`):'';
const rpInvest=r=>r.investments?rpSection(t('set.reportHtml.investedWhere'),`<table class="rp-table">${r.investments.items.map(i=>
  `<tr><td class="rp-name">${esc(i.name)}</td><td class="rp-barcell">${rpBar(i.share)}</td><td class="rp-num">${rpF2(i.value)}</td><td class="rp-num rp-dim">${pc(i.share)}</td></tr>`).join('')}</table>
  <p class="rp-text">${t('set.reportHtml.total',{value:rpF2(r.investments.total)})}</p>`):'';
function rpBudgets(r){
  if(!r.budgets)return '';
  const rows=r.budgets.rows.map(b=>`<tr><td class="rp-name">${esc(displayName(b.group))}</td><td class="rp-barcell">${rpBar(b.share,b.level)}</td><td class="rp-num">${t('set.reportHtml.budgetOf',{spent:rpF2(b.spent),budget:rpF2(b.budget)})}</td><td class="rp-num rp-${b.level}-t">${t(RP_BUDGET_TEXT[b.level])}</td></tr>`).join('');
  return rpSection(t('set.reportHtml.budgets'),`<table class="rp-table">${rows}</table>`);
}
function rpCardReserve(r){
  const lines=[];
  if(r.card)lines.push(`<li>${t('set.reportHtml.cardLine',{name:esc(invoiceName(r.card.fm)),rest:rpF2(r.card.rest),due:formatDateBR(r.card.due)})}</li>`);
  const e=r.reserve;
  if(e)lines.push(e.months===null?`<li>${t('set.reportHtml.reserveNoHistory',{balance:rpF2(e.balance)})}</li>`
    :`<li>${t('set.reportHtml.reserveLine',{balance:rpF2(e.balance),months:rpComma(e.months.toFixed(1)),target:e.target,level:t(RP_RESERVE_TEXT[e.level])})}</li>`);
  return lines.length?rpSection(t('set.reportHtml.cardReserve'),`<ul class="rp-list">${lines.join('')}</ul>`):'';
}
const rpFoot=()=>`<footer class="rp-foot">${t('set.reportHtml.foot')}</footer>`;
// the whole report
export function reportHtml(r){
  return `<article class="rp-page">${rpHead(r)}${rpLead(r)}${r.hasData?rpTiles(r)+rpAttention(r)+rpGoal(r)+rpSpending(r)+rpTrend(r)+rpBiggest(r)+rpInvest(r)+rpBudgets(r)+rpCardReserve(r):''}${rpFoot()}</article>`;
}

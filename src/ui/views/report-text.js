/**
 * ui/views/report-text.js
 * Responsibility: the report as plain text for an e-mail (subject and body), from domain/report.js. Short on
 * purpose: mail programs cut very long links, so the sections go by importance and the text stops at the limit.
 * Pure text builder: no DOM, no state.
 */
import { t } from '../../core/i18n.js';
import { f0, f2, pc } from '../../core/format.js';
import { formatDateBR, mLabel } from '../../core/dates.js';
import { invoiceName } from '../invoice-name.js';
export const MAIL_BODY_LIMIT=1500; // characters of text before encoding
const money=v=>(v<0?'-':'')+f2(Math.abs(v));
const ATTENTION={
  'invoice-late':a=>a.count>1?t('set.reportText.lateMany',{count:a.count,rest:f2(a.rest)}):t('set.reportText.lateOne',{name:invoiceName(a.fm),rest:f2(a.rest)}),
  'invoice-due':a=>t(a.days===1?'set.reportText.dueOne':'set.reportText.dueMany',{name:invoiceName(a.fm),days:a.days,rest:f2(a.rest)}),
  'budget-over':a=>t('set.reportText.budgetOver',{groups:a.groups.join(', ')}),
  'bills-missing':a=>t(a.count===1?'set.reportText.billsOne':'set.reportText.billsMany',{count:a.count}),
  'no-contribution':()=>t('set.reportText.noContribution'),
  'no-reserve':()=>t('set.reportText.noReserve')};
export const reportSubject=r=>t('set.reportText.title',{month:mLabel(r.m)});
// the sections in order of importance; each one is a list of lines
function sections(r){
  const x=r.month,g=r.goal;
  const out=[[t('set.reportText.title',{month:mLabel(r.m)}),r.current?t('set.reportText.valuesUntil',{date:formatDateBR(r.day).slice(0,5)}):'']];
  if(!r.hasData)return out.concat([[t('set.reportText.noTx')]]);
  out.push([t('set.reportText.in',{value:f2(x.income)}),t('set.reportText.out',{value:f2(x.expenses)}),x.rate!==null&&x.left>0?t('set.reportText.leftRate',{value:money(x.left),rate:pc(x.rate)}):t('set.reportText.left',{value:money(x.left)}),
    t('set.reportText.networth',{value:f2(g.networth),progress:pc(g.progress),target:f0(g.target)})]);
  if(r.attention.length)out.push([t('set.reportText.attention')].concat(r.attention.map(a=>'- '+ATTENTION[a.code](a.data))));
  if(r.spending.length)out.push([t('set.reportText.whereMoneyWent')].concat(r.spending.map(s=>`- ${s.name}: ${f2(s.value)} (${pc(s.share)})`)));
  if(g.monthsLeft!==null&&!g.reached&&g.etaMonth)out.push([t('set.reportText.forecast',{month:mLabel(g.etaMonth).toLowerCase(),planned:f0(g.planned)})]);
  return out;
}
export function reportMailBody(r){
  const blocks=sections(r).map(b=>b.filter(Boolean).join('\n')),foot=t('set.reportText.foot');
  let body='';
  for(const b of blocks){const next=body?body+'\n\n'+b:b;if(next.length>MAIL_BODY_LIMIT)break;body=next;}
  return body+'\n\n'+foot;
}
export const reportMailUrl=r=>`mailto:?subject=${encodeURIComponent(reportSubject(r))}&body=${encodeURIComponent(reportMailBody(r))}`;

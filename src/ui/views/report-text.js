/**
 * ui/views/report-text.js
 * Responsibility: the report as plain text for an e-mail (subject and body), from domain/report.js. Short on
 * purpose: mail programs cut very long links, so the sections go by importance and the text stops at the limit.
 * Pure text builder: no DOM, no state.
 */
import { f0, f2, pc } from '../../core/format.js';
import { formatDateBR, mLabel } from '../../core/dates.js';
import { invoiceName } from '../invoice-name.js';
export const MAIL_BODY_LIMIT=1500; // characters of text before encoding
const money=v=>(v<0?'-':'')+f2(Math.abs(v));
const ATTENTION={
  'invoice-late':a=>a.count>1?`${a.count} faturas vencidas sem pagamento lançado (${f2(a.rest)})`:`${invoiceName(a.fm)} venceu e não foi paga (${f2(a.rest)})`,
  'invoice-due':a=>`${invoiceName(a.fm)} vence em ${a.days} dia${a.days===1?'':'s'} (${f2(a.rest)})`,
  'budget-over':a=>`Passou do limite de gastos em: ${a.groups.join(', ')}`,
  'bills-missing':a=>`${a.count} conta${a.count===1?'':'s'} do mês ainda não lançada${a.count===1?'':'s'}`,
  'no-contribution':()=>'Nenhum aporte neste mês ainda',
  'no-reserve':()=>'Falta marcar a reserva de emergência'};
export const reportSubject=r=>'Relatório financeiro: '+mLabel(r.m);
// the sections in order of importance; each one is a list of lines
function sections(r){
  const x=r.month,g=r.goal;
  const out=[[`Relatório financeiro: ${mLabel(r.m)}`,r.current?`(valores até ${formatDateBR(r.day).slice(0,5)})`:'']];
  if(!r.hasData)return out.concat([['Ainda não há lançamentos neste mês.']]);
  out.push([`Entrou: ${f2(x.income)}`,`Saiu: ${f2(x.expenses)}`,`Sobrou: ${money(x.left)}${x.rate!==null&&x.left>0?` (${pc(x.rate)} do que entrou)`:''}`,
    `Patrimônio: ${f2(g.networth)} (${pc(g.progress)} da meta de ${f0(g.target)})`]);
  if(r.attention.length)out.push(['Atenção:'].concat(r.attention.map(a=>'- '+ATTENTION[a.code](a.data))));
  if(r.spending.length)out.push(['Para onde foi o dinheiro:'].concat(r.spending.map(s=>`- ${s.name}: ${f2(s.value)} (${pc(s.share)})`)));
  if(g.monthsLeft!==null&&!g.reached&&g.etaMonth)out.push([`Previsão da meta: ${mLabel(g.etaMonth).toLowerCase()} (aporte de ${f0(g.planned)}/mês).`]);
  return out;
}
export function reportMailBody(r){
  const blocks=sections(r).map(b=>b.filter(Boolean).join('\n')),foot='Para anexar o relatório completo, use Imprimir / PDF no app, salve o arquivo e anexe a este e-mail.';
  let body='';
  for(const b of blocks){const next=body?body+'\n\n'+b:b;if(next.length>MAIL_BODY_LIMIT)break;body=next;}
  return body+'\n\n'+foot;
}
export const reportMailUrl=r=>`mailto:?subject=${encodeURIComponent(reportSubject(r))}&body=${encodeURIComponent(reportMailBody(r))}`;

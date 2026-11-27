/**
 * ui/components/breakdown.js
 * Responsibility: reusable list pieces. txRow() draws one record (icon, title, date and payment,
 * value with sign); listView() builds a sheet view with total, count and grouped rows.
 * Rows with data-tx open the record detail (see transaction-actions.js).
 */
import { esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { formatDateBR, mShort } from '../../core/dates.js';
import { accName } from '../../domain/accounts.js';
import { isReinvestment } from '../../domain/reinvestment.js';
import { catParts } from '../../domain/transactions.js';
import { icon } from '../../domain/categories.js';
import { dueDateOf, dueMonth, invoiceMonthOf } from '../../domain/card-cycle.js';
export const TX_SIGN={receita:'+',despesa:'−',fatura:'−',aporte:'→'};
export function paymentLabel(t){
  if(t.type==='aporte')return 'Investimento';
  if(t.type==='fatura')return 'Conta';
  if(t.fonte==='cartao')return 'Cartão · fatura '+mShort(dueMonth(t.date));
  if(t.fonte==='beneficio')return 'VR/VA';
  return t.type==='receita'?'Conta':'Pix / conta';
}
export function txTitle(t){
  if(t.type==='fatura')return 'Pagamento da fatura de '+formatDateBR(dueDateOf(invoiceMonthOf(t)));
  if(isReinvestment(t))return 'Reinvestimento em '+accName(t.acc);
  if(t.type==='aporte')return 'Aporte em '+accName(t.acc);
  return t.desc||t.cat||'Sem descrição';
}
function txIcon(t){return t.type==='fatura'?'💳':isReinvestment(t)?'🔁':t.type==='aporte'?'🏦':icon(t.type,t.cat);}
// o: {value, sign, sub, title, actions, cls}
export function txRow(t,o){
  o=o||{};
  const v=o.value!==undefined?o.value:t.value,sign=o.sign!==undefined?o.sign:TX_SIGN[t.type];
  const cat=t.type==='despesa'||t.type==='receita'?(t.splits&&t.splits.length?catParts(t).map(p=>p.cat).join(' + '):t.cat):'';
  // o.sub is HTML built by the caller; the default line carries user text (category, account) and is escaped
  const sub=o.sub!==undefined?o.sub:esc([formatDateBR(t.date),t.desc&&cat?cat:'',paymentLabel(t)].filter(Boolean).join(' · '));
  return `<div class="li ${o.cls||''}" data-tx="${t.id}" role="button" tabindex="0" aria-label="${esc(txTitle(t))}, ${esc(f2(v))}. Abrir detalhes">
    <span class="li-ic" aria-hidden="true">${txIcon(t)}</span>
    <span class="li-main"><span class="li-t">${esc(o.title||txTitle(t))}${t.serie?' <span class="li-badge" title="Repete todo mês">🔁</span>':''}</span><span class="li-s">${sub}</span></span>
    <span class="li-v ${t.type}">${sign?sign+' ':''}${f2(v)}</span>${o.actions||''}</div>`;
}
// row that is not a single transaction (opening balance, undetailed amount, a month, a category)
export function infoRow(o){
  const attrs=o.attrs||'';
  return `<div class="li ${o.attrs?'':'li-static'} ${o.cls||''}" ${attrs} ${o.attrs?'role="button" tabindex="0"':''}>
    <span class="li-ic" aria-hidden="true">${o.icon||'•'}</span>
    <span class="li-main"><span class="li-t">${o.title}</span>${o.sub?`<span class="li-s">${o.sub}</span>`:''}</span>
    <span class="li-v ${o.vcls||''}">${o.value}</span></div>`;
}
export const signedMoney=v=>(v<0?'− ':'')+f2(Math.abs(v));
/**
 * listView(build): build() is called on every draw, so the list follows edits and deletions.
 * build() -> {title, sub, total(text), totalLabel, count, groups:[{label, total, rows:[html]}], note, empty}
 */
export function listView(build){
  return {render(body){
    const s=build();
    const n=s.count!==undefined?s.count:s.groups.reduce((a,g)=>a+g.rows.length,0);
    const groups=s.groups.filter(g=>g.rows.length||g.always);
    body.innerHTML=`<div class="bd-total"><div class="bd-k">${s.totalLabel||'Total'}</div><div class="bd-v">${s.total}</div><div class="bd-n">${n} ${n===1?(s.unit||'lançamento'):(s.units||'lançamentos')}${s.period?' · '+s.period:''}</div></div>`+
      (s.note?`<div class="bd-note">${s.note}</div>`:'')+
      (groups.length?groups.map(g=>`<div class="bd-g">${g.label?`<div class="bd-gh"><span>${g.label}</span>${g.total!==undefined?`<b>${g.total}</b>`:''}</div>`:''}<div class="lst">${g.rows.join('')||'<div class="empty sm">Nada aqui.</div>'}</div></div>`).join('')
        :`<div class="empty">${s.empty||'Nenhum lançamento neste período.'}</div>`);
    return {title:s.title,sub:s.sub};
  }};
}

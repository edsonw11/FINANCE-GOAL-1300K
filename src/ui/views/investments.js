/**
 * ui/views/investments.js
 * Responsibility: Patrimônio, accounts part: balance of each account (reserve / archive in the ⋯ menu),
 * the form to update balances and the net worth history.
 */
import { $, esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f2, m2, pc } from '../../core/format.js';
import { formatDateBR, mShort, today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { active, balance, total, totalGross } from '../../domain/accounts.js';
import { realSeries } from '../../domain/investments.js';
import { setReserveAccount } from '../../domain/emergency-fund.js';
import { addAccount, archiveAccount, saveSnapshots } from '../../domain/account-commands.js';
import { bindDistribution, renderDistribution } from './distribution-view.js';
import { renderPortfolio } from './portfolio-view.js';
import { accColor } from '../account-colors.js';
import { askConfirm } from '../components/confirm.js';
import { fieldError } from '../components/field-error.js';
import { runCommand } from '../components/command.js';
import { bindMoreMenus, moreMenu } from '../components/more-menu.js';
// one account: name, when the balance was given, value; the rare actions stay in the ⋯ menu
function accountRow(a,d){
  const b=balance(a.id,d),sn=b.snap;
  const sub=sn?t(['sum.accounts.balanceAsOf','sum.accounts.balanceAsOfEst','sum.accounts.balanceAsOfAfter','sum.accounts.balanceAsOfEstAfter'][(sn.est?1:0)+(b.v!==sn.value?2:0)],{date:formatDateBR(sn.date)}):t('sum.accounts.noBalance');
  const menu=moreMenu([{label:a.reserve?t('sum.accounts.unmarkReserve'):t('sum.accounts.markReserve'),attrs:`data-reserve="${a.id}" aria-pressed="${!!a.reserve}"`},
    {label:t('sum.accounts.archiveItem'),attrs:`data-arq="${a.id}"`}],t('sum.accounts.actionsOf',{name:esc(a.name)}));
  return `<div class="acc"><i style="background:${accColor(a.id)}"></i><div class="nm">${esc(a.name)}${a.reserve?' '+t('sum.accounts.reserveBadge'):''}<span class="sb">${sub}</span></div><div class="vl r">${f2(b.v)}<span class="sb fw5">${b.g!==null?t('sum.accounts.grossTax',{gross:f2(b.g),tax:f2(b.g-b.v)}):t('sum.accounts.grossMissing')}</span></div>${menu}</div>`;
}
export function renderInvestments(){
  const d=today();renderDistribution();renderPortfolio();
  $('accList').innerHTML=active().map(a=>accountRow(a,d)).join('')+
    (()=>{const tg=totalGross(d);return `<div class="acc"><i class="swatch-total"></i><div class="nm">${t('sum.list.total')}<span class="sb">${t('sum.accounts.netNote')}</span></div><div class="vl r">${f2(total(d))}<span class="sb fw5">${t('sum.accounts.totalGross',{approx:tg.ok?'':'≈ ',gross:f2(tg.g),tax:f2(tg.g-total(d))})}</span></div></div>`;})();
  bindMoreMenus($('accList'));
  $('snapForm').innerHTML=`<div class="snap-grid help"><span></span><b>${t('sum.accounts.netBalanceHead')}</b><b>${t('sum.accounts.grossBalanceHead')}</b></div>`+
    active().map(a=>{const b=balance(a.id,d);return `<div class="snap-grid c"><label for="s_${a.id}" class="m0"><i class="swatch" style="background:${accColor(a.id)}"></i>${esc(a.name)}</label><input id="s_${a.id}" inputmode="decimal" value="${m2(b.v)}"><input id="g_${a.id}" inputmode="decimal" placeholder="${t('sum.accounts.grossPlaceholder')}" value="${b.g!==null?m2(b.g):''}"></div>`;}).join('');
  $('snapDate').value=d;
  const real=realSeries();
  $('histTbl').innerHTML=`<tr><th>${t('sum.common.month')}</th><th>${t('sum.common.netWorth')}</th><th>${t('sum.common.contributions')}</th><th>${t('sum.common.yield')}</th><th>${t('sum.accounts.pctMonth')}</th><th>${t('sum.accounts.expected')}</th></tr>`+
    [...real].reverse().map(r=>{const exp=r.prev!==null?r.prev*(Math.pow(1+S.rate/100,1/12)-1):null;
      const cls=r.y===null?'':(r.y>=exp?'pos':'neg');
      return `<tr><td>${mShort(r.m)}</td><td>${f2(r.t)}</td><td>${r.ap?f2(r.ap):'—'}</td><td class="${cls}">${r.y===null?'—':f2(r.y)}</td><td class="${cls}">${r.y===null?'—':pc(r.y/r.prev)}</td><td class="mut">${exp===null?'—':f2(exp)}</td></tr>`;}).join('');
}
export function bindInvestments(){
bindDistribution();
$('snapSave').onclick=()=>{const d=$('snapDate').value;if(!d)return fieldError($('snapDate'),t('sum.accounts.pickDate'));
  const rows=active().map(a=>({acc:a.id,value:parseMoney($('s_'+a.id).value),gross:parseMoney($('g_'+a.id).value)}));
  runCommand(()=>saveSnapshots(d,rows),{ok:t('sum.accounts.snapSaved',{date:formatDateBR(d)})});};
$('accList').onclick=e=>{const r=e.target.closest('[data-reserve]');if(r){const a=S.accounts.find(x=>x.id===r.dataset.reserve);return runCommand(()=>setReserveAccount(a.id,!a.reserve));}
  const b=e.target.closest('[data-arq]');if(!b)return;const a=S.accounts.find(x=>x.id===b.dataset.arq);
  if(Math.abs(balance(a.id,today()).v)>0.005)return runCommand(()=>archiveAccount(a.id)); // shows why it cannot be archived
  askConfirm({title:t('sum.accounts.archiveTitle'),text:t('sum.accounts.archiveText',{name:a.name}),ok:t('sum.accounts.archiveOk')})
    .then(r=>{if(r)runCommand(()=>archiveAccount(a.id),{ok:t('sum.accounts.archived',{name:a.name})});});};
$('addAcc').onclick=()=>{if(runCommand(()=>addAccount($('newAcc').value),{ok:t('sum.accounts.added')}))$('newAcc').value='';};
}

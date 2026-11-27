/**
 * ui/views/import-custody-view.js
 * Responsibility: the screen shown when the file is a broker custody statement: the balance it reports,
 * the account to update (or a new one, with the name suggested from the statement) and the comparison with
 * what the app has today. Confirms, then applies it as a balance snapshot through the domain command.
 * No transaction is created.
 */
import { $, esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f2 } from '../../core/format.js';
import { formatDateBR } from '../../core/dates.js';
import { active, accName } from '../../domain/accounts.js';
import { applyCustody, applyCustodyToNewAccount, currentBalance } from '../../domain/import-custody.js';
import { NEW_ACCOUNT } from '../../domain/import-account.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { Sheet } from '../components/sheet.js';
// no account picked yet: a new one is the natural choice when there is none that matches
function startChoice(s){
  if(s.acc===undefined||s.acc===null||s.acc==='')s.acc=active().length?'':NEW_ACCOUNT;
  if(s.newName===undefined)s.newName=s.custody.name||'';
}
const isNew=s=>s.acc===NEW_ACCOUNT;
export function custodyHtml(s){
  startChoice(s);
  const c=s.custody,now=s.acc&&!isNew(s)?currentBalance(s.acc,c.date):null;
  return `<div class="imp-banner">${t('imp.custody.banner',{date:formatDateBR(c.date)})}</div>
    <div class="imp-file"><b>${esc(s.file.name)}</b></div>
    <div class="imp-tiles">
      <div><span>${t('imp.custody.gross')}</span><b>${f2(c.gross)}</b></div>
      <div><span>${t('imp.custody.ir')}</span><b>${f2(c.ir)}</b></div>
      <div><span>IOF</span><b>${f2(c.iof)}</b></div>
      <div><span>${t('imp.custody.net')}</span><b class="rec">${f2(c.net)}</b></div>
    </div>
    <div class="formgrid"><div class="span-all"><label>${t('imp.custody.updateOf')}</label>
      <select id="cuAcc"><option value=""${!s.acc?' selected':''}>${t('imp.custody.chooseAccountOption')}</option>${active().map(a=>`<option value="${a.id}"${s.acc===a.id?' selected':''}>${esc(a.name)}</option>`).join('')}<option value="${NEW_ACCOUNT}"${isNew(s)?' selected':''}>${t('imp.common.newAccountOption')}</option></select></div>
      ${isNew(s)?`<div class="span-all"><label for="cuNew">${t('imp.common.newAccountName')}</label><input id="cuNew" value="${esc(s.newName)}" placeholder="${t('imp.custody.newNameHint')}"></div>`:''}</div>
    ${!active().length?`<div class="help">${t('imp.custody.noAccounts')}</div>`:''}
    ${now!==null?`<div class="help">${t('imp.custody.compare',{now:f2(now),account:esc(accName(s.acc)),net:f2(c.net)})}</div>`:''}`;
}
export function bindCustody(s,body,foot){
  foot.innerHTML=`<button type="button" class="btn" id="cuCancel">${t('imp.common.cancel')}</button><button type="button" class="btn pri" id="cuGo">${t('imp.custody.update')}</button>`;
  const go=$('cuGo'),ready=()=>isNew(s)?!!s.newName.trim():!!s.acc;go.disabled=!ready();
  $('cuCancel').onclick=()=>Sheet.close();
  $('cuAcc').onchange=e=>{s.acc=e.target.value;Sheet.refresh();};
  const nm=$('cuNew');if(nm)nm.oninput=()=>{s.newName=nm.value;go.disabled=!ready();};
  go.onclick=async()=>{
    const c=s.custody,yes=await askConfirm({title:t('imp.custody.confirmTitle'),ok:t('imp.custody.confirmOk'),
      html:`<div>${isNew(s)?t('imp.custody.confirmNew',{name:esc(s.newName.trim()),date:formatDateBR(c.date)}):t('imp.custody.confirmOn',{name:esc(accName(s.acc)),date:formatDateBR(c.date)})}<br>${t('imp.custody.confirmNet',{value:f2(c.net)})}<br>${t('imp.custody.confirmGross',{value:f2(c.gross)})}</div><div class="mut mt-10">${t('imp.custody.confirmNote')}</div>`});
    if(!yes)return;
    const r=isNew(s)?runCommand(()=>applyCustodyToNewAccount(c,s.newName),{ok:t('imp.custody.okNew')})
      :runCommand(()=>applyCustody(c,s.acc),{ok:t('imp.custody.okUpdated')});
    if(r)Sheet.close();
  };
}

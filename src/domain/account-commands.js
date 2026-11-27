/**
 * domain/account-commands.js
 * Responsibility: commands for investment accounts and their balances (snapshots).
 */
import { t } from '../core/i18n.js';
import { today } from '../core/dates.js';
import { roundMoney } from '../core/money.js';
import { S } from './store.js';
import { balance } from './accounts.js';
export function addAccount(name){const n=(name||'').trim();if(!n)return {error:t('tx.acct.nameRequired')};const id='a'+(S.nid++);S.accounts.push({id,name:n});return {id};}
export function archiveAccount(id){
  const a=S.accounts.find(x=>x.id===id);if(!a)return {error:t('tx.acct.notFound')};
  if(Math.abs(balance(id,today()).v)>0.005)return {error:t('tx.acct.zeroFirst',{name:a.name})};
  a.archived=true;return {name:a.name};
}
// rows: [{acc, value, gross}] -> one snapshot per account and day (replaces the same day)
export function saveSnapshots(date,rows){
  rows.forEach(({acc,value,gross})=>{
    S.snaps=S.snaps.filter(s=>!(s.acc===acc&&s.date===date));
    const sn={date,acc,value:roundMoney(value),est:false};if(gross>0)sn.gross=roundMoney(gross);S.snaps.push(sn);
  });
}

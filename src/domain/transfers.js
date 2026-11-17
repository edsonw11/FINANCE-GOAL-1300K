/**
 * domain/transfers.js
 * Responsibility: transfers between the user's own accounts (Santander -> Nubank...). They are not
 * transactions (never income or expense) but are kept in S.transfers so that, when the statement of
 * the other bank is imported, its side is recognised: same value, opposite direction, a few days apart.
 * Also finds the other side among records already saved as income/expense (an earlier import that
 * did not know it was a transfer) and turns such a record into a transfer when the user confirms.
 */
import { daysBetween, formatDateBR } from '../core/dates.js';
import { roundMoney, toCents } from '../core/money.js';
import { S } from './store.js';
import { IMPORT_TYPE, looksLikeTransfer } from './import-classify.js';
import { mentionsOwnName, ownNames } from './own-names.js';
export const PAIR_MAX_DAYS=3; // a TED on Friday arrives on Monday
export const PAIR_KIND={transfer:'transfer',record:'record'};
export const transfers=()=>S.transfers||[];
const near=(a,b)=>Math.abs(daysBetween(a,b))<=PAIR_MAX_DAYS;
// direction of a draft: 'out' (money left this account) | 'in'
const dirOf=d=>d.flow||(d.type===IMPORT_TYPE.income?'in':'out');
const opposite=dir=>dir==='in'?'out':'in';
// saved income/expense of the account (not card, not VR) that could be the other side of a transfer
const pairableRecord=(t,dir)=>t.fonte==='caixa'&&!t.serie&&(dir==='in'?t.type==='despesa':t.type==='receita')&&(looksLikeTransfer(t.desc)||mentionsOwnName(t.desc,ownNames()));
/**
 * Marks each draft whose other side is known. d.pair = {kind, id, date, desc, value}.
 * kind 'transfer': the other side was already kept as a transfer -> the draft becomes a transfer too.
 * kind 'record': the other side was saved as income/expense -> the user can fix both (fixPair).
 * A transfer already kept with the same key is a confirmed duplicate.
 */
export function markTransferPairs(drafts){
  const keys=new Set(transfers().map(t=>t.key).filter(Boolean)),used=new Set();
  drafts.forEach(d=>{
    d.pair=null;
    if(d.key&&keys.has(d.key)){d.dup={level:'confirmed',text:'Transferência já registrada antes (nada foi duplicado)'};d.selected=false;return;}
    if(!d.date||!(d.value>0)||d.type===IMPORT_TYPE.ignore||d.type===IMPORT_TYPE.contribution)return;
    const dir=dirOf(d),want=opposite(dir);
    const tr=transfers().find(t=>!t.pair&&!used.has(t.id)&&t.dir===want&&toCents(t.value)===toCents(d.value)&&near(t.date,d.date));
    if(tr){used.add(tr.id);d.pair={kind:PAIR_KIND.transfer,id:tr.id,date:tr.date,desc:tr.desc,value:tr.value};
      if(d.type!==IMPORT_TYPE.ownTransfer){d.type=IMPORT_TYPE.ownTransfer;d.selected=false;d.cat='';}
      return;}
    const rec=S.tx.find(t=>!used.has(t.id)&&toCents(t.value)===toCents(d.value)&&near(t.date,d.date)&&pairableRecord(t,dir));
    if(rec){used.add(rec.id);d.pair={kind:PAIR_KIND.record,id:rec.id,date:rec.date,desc:rec.desc||rec.cat,value:rec.value,type:rec.type};
      if(!d.flags.includes('transfer-pair'))d.flags.push('transfer-pair');}
  });
}
// text of the pair for the review card
export const pairText=p=>`${p.kind===PAIR_KIND.transfer?'Outro lado':'Parece o outro lado de'} “${p.desc}” de ${formatDateBR(p.date)}`;
// a saved income/expense becomes a transfer (removed from the records, kept in S.transfers)
export function recordToTransfer(id){
  const t=S.tx.find(x=>x.id===id);if(!t)return {error:'Lançamento não encontrado'};
  const tr={id:'tr'+(S.nid++),key:t.imp||'',date:t.date,value:roundMoney(t.value),dir:t.type==='despesa'?'out':'in',desc:t.desc||t.cat,pair:null};
  S.tx=S.tx.filter(x=>x.id!==id);S.transfers=transfers().concat([tr]);
  return {transfer:tr};
}
// called when an import is confirmed: keeps every draft of type transfer (once), links the pairs and
// turns the confirmed "other side" records into transfers. -> {kept, fixed}
export function keepTransfers(drafts){
  const keys=new Set(transfers().map(t=>t.key).filter(Boolean));let kept=0,fixed=0;
  drafts.filter(d=>d.type===IMPORT_TYPE.ownTransfer&&d.date&&d.value>0&&!(d.key&&keys.has(d.key))).forEach(d=>{
    let other=null;
    if(d.pair&&d.pair.kind===PAIR_KIND.record&&d.fixPair){const r=recordToTransfer(d.pair.id);if(!r.error){other=r.transfer;fixed++;}}
    if(d.pair&&d.pair.kind===PAIR_KIND.transfer)other=transfers().find(t=>t.id===d.pair.id)||null;
    const tr={id:'tr'+(S.nid++),key:d.key||'',date:d.date,value:roundMoney(d.value),dir:dirOf(d),desc:d.desc,pair:other?other.id:null};
    if(other)other.pair=tr.id;
    S.transfers=transfers().concat([tr]);if(d.key)keys.add(d.key);kept++;
  });
  return {kept,fixed};
}

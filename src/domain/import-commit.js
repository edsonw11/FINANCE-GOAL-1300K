/**
 * domain/import-commit.js
 * Responsibility: the only place where reviewed import drafts become transactions. Called after the
 * user confirmed. Saves each selected draft through the same builder as the manual form
 * (validation, categories, series for installments), tags it with the import key so the same
 * row can never be saved twice, and reports the outcome item by item. Does not touch existing records.
 * commitImport(drafts, {fileHash, fileName, at}) -> {saved, items:[{id, status:'saved'|'skipped'|'failed', reason}], months, transfers, fixedPairs, accounts (names created)}
 * Transfers between own accounts are kept by domain/transfers.js (not as transactions). A contribution
 * to a new account creates that account here (once per name), so the preview never saves anything.
 */
import { S } from './store.js';
import { saveTransaction, validateTransaction } from './transaction-builder.js';
import { draftProblems, targetMonth } from './import-draft.js';
import { dropTransfersOf, keepTransfers } from './transfers.js';
import { splitParts } from './import-split.js';
import { NEW_ACCOUNT, accountNamed } from './import-account.js';
import { addAccount } from './account-commands.js';
const MAX_LOG=200;
export const formOfDraft=d=>({editId:null,type:d.type,value:d.value,date:d.date,cat:d.cat,fonte:d.fonte,acc:d.type==='aporte'?d.acc:undefined,desc:d.desc,splits:splitParts(d).map(p=>({cat:p.cat.trim(),value:p.value})),
  repeat:d.installment&&d.createRest?Math.max(1,d.installment.of-d.installment.n+1):1});
export function commitImport(drafts,meta){
  meta=meta||{};
  const items=[],months=new Set(),taken=new Set(S.tx.map(t=>t.imp).filter(Boolean));let saved=0;const created=[];
  // the id of the account the user named: an existing one with that name, or created now
  const accountOf=name=>{const a=accountNamed(name);if(a)return a.id;const r=addAccount(name);if(r.id)created.push(name.trim());return r.id||'';};
  drafts.filter(d=>d.selected).forEach(d=>{
    const problems=draftProblems(d);
    if(problems.length)return items.push({id:d.id,status:'failed',reason:problems[0]});
    if(d.key&&taken.has(d.key))return items.push({id:d.id,status:'skipped',reason:'Já importado antes (nada foi duplicado)'});
    const form=formOfDraft(d),err=validateTransaction(form);
    if(err)return items.push({id:d.id,status:'failed',reason:err.msg});
    if(form.acc===NEW_ACCOUNT)form.acc=accountOf(d.newAcc);
    const r=saveTransaction(form);
    r.ids.forEach((id,i)=>{const t=S.tx.find(x=>x.id===id);if(t&&d.key)t.imp=i===0?d.key:d.key+'/'+i;});
    if(d.key)taken.add(d.key);
    months.add(targetMonth(d));saved++;
    items.push({id:d.id,status:'saved',count:r.ids.length});
  });
  // a line kept as a transfer before and now saved as income/expense is no longer a transfer
  dropTransfersOf(drafts.filter(d=>items.some(i=>i.id===d.id&&i.status==='saved')).map(d=>d.key));
  const tr=keepTransfers(drafts); // transfers between own accounts: kept apart, never income/expense
  if((saved||tr.kept)&&meta.fileHash){
    S.imports=(S.imports||[]).concat([{hash:meta.fileHash,name:meta.fileName||'',at:meta.at||'',count:saved,transfers:tr.kept}]).slice(-MAX_LOG);
  }
  return {saved,items,months:[...months].sort(),transfers:tr.kept,fixedPairs:tr.fixed,accounts:created};
}

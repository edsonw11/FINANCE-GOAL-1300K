/**
 * domain/import-commit.js
 * Responsibility: the only place where reviewed import drafts become transactions. Called after the
 * user confirmed. Saves each selected draft through the same builder as the manual form
 * (validation, categories, series for installments), tags it with the import key so the same
 * row can never be saved twice, and reports the outcome item by item. Does not touch existing records.
 * commitImport(drafts, {fileHash, fileName, at}) -> {saved, items:[{id, status:'saved'|'skipped'|'failed', reason}], months}
 */
import { S } from './store.js';
import { saveTransaction, validateTransaction } from './transaction-builder.js';
import { draftProblems, targetMonth } from './import-draft.js';
const MAX_LOG=200;
export const formOfDraft=d=>({editId:null,type:d.type,value:d.value,date:d.date,cat:d.cat,fonte:d.fonte,acc:d.type==='aporte'?d.acc:undefined,desc:d.desc,splits:[],
  repeat:d.installment&&d.createRest?Math.max(1,d.installment.of-d.installment.n+1):1});
export function commitImport(drafts,meta){
  meta=meta||{};
  const items=[],months=new Set(),taken=new Set(S.tx.map(t=>t.imp).filter(Boolean));let saved=0;
  drafts.filter(d=>d.selected).forEach(d=>{
    const problems=draftProblems(d);
    if(problems.length)return items.push({id:d.id,status:'failed',reason:problems[0]});
    if(d.key&&taken.has(d.key))return items.push({id:d.id,status:'skipped',reason:'Já importado antes (nada foi duplicado)'});
    const form=formOfDraft(d),err=validateTransaction(form);
    if(err)return items.push({id:d.id,status:'failed',reason:err.msg});
    const r=saveTransaction(form);
    r.ids.forEach((id,i)=>{const t=S.tx.find(x=>x.id===id);if(t&&d.key)t.imp=i===0?d.key:d.key+'/'+i;});
    if(d.key)taken.add(d.key);
    months.add(targetMonth(d));saved++;
    items.push({id:d.id,status:'saved',count:r.ids.length});
  });
  if(saved&&meta.fileHash){
    S.imports=(S.imports||[]).concat([{hash:meta.fileHash,name:meta.fileName||'',at:meta.at||'',count:saved}]).slice(-MAX_LOG);
  }
  return {saved,items,months:[...months].sort()};
}

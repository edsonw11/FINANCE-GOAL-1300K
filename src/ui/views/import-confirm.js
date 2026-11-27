/**
 * ui/views/import-confirm.js
 * Responsibility: the explicit confirmation before anything is saved, and the save itself. Shows how many
 * items and the totals, runs the domain command through runCommand (rollback if the browser cannot
 * save), blocks a second tap while saving, and stores the result per item for the result screen.
 */
import { esc } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { f2 } from '../../core/format.js';
import { mShort, today } from '../../core/dates.js';
import { commitImport } from '../../domain/import-commit.js';
import { importOverview, needsReview } from '../../domain/import-draft.js';
import { ui } from '../ui-state.js';
import { toast } from '../toast.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { render } from '../render.js';
import { importState, keepUnsaved } from './import-session.js';
export async function confirmAndCommit(){
  const s=importState.session;if(!s||s.busy)return false;
  const ov=importOverview(s.drafts),sel=ov.selected;
  if(!sel.count&&!ov.transfers){toast(t('imp.confirm.selectOne'));return false;}
  const toCheck=s.drafts.filter(d=>d.selected&&needsReview(d)).length,possible=s.drafts.filter(d=>d.selected&&d.dup).length;
  s.busy=true;
  const title=sel.count?t('imp.confirm.titleTx',{count:sel.count}):t('imp.confirm.titleTransfers',{count:ov.transfers});
  const yes=await askConfirm({title,ok:sel.count?t('imp.confirm.okImport',{count:sel.count}):t('imp.confirm.okKeep'),
    html:`<div>${t('imp.confirm.income',{value:f2(sel.income)})}<br>${t('imp.confirm.expense',{value:f2(sel.expense)})}<br>${sel.contribution?`${t('imp.confirm.contribution',{value:f2(sel.contribution)})}<br>`:''}${sel.count?t('imp.confirm.months',{months:sel.months.map(m=>esc(mShort(m))).join(', ')}):''}${ov.transfers?`<br>${t('imp.confirm.transfers',{count:ov.transfers,total:f2(ov.transferTotal)})}`:''}</div>
      ${toCheck?`<div class="bd-note mt-10">${t('imp.confirm.toCheck',{count:toCheck})}</div>`:''}
      ${possible?`<div class="bd-note mt-10">${t('imp.confirm.possible',{count:possible})}</div>`:''}
      ${ov.pairFixes?`<div class="bd-note mt-10">${t('imp.confirm.pairFixes',{count:ov.pairFixes})}</div>`:`<div class="mut mt-10">${t('imp.confirm.nothingChanged')}</div>`}`});
  if(!yes){s.busy=false;return false;}
  const r=runCommand(()=>commitImport(s.drafts,{fileHash:s.read.fileHash,fileName:s.read.fileName,at:today()}),{render:false});
  s.busy=false;
  if(!r)return false; // saving failed: nothing changed and the review is still here
  s.snapshot=s.drafts.map(d=>({id:d.id,desc:d.desc,value:d.value}));
  s.result=r;keepUnsaved(r.items);s.phase='result';
  if(r.months.length)ui.cur=r.months[r.months.length-1];
  render();toast(r.saved?t('imp.confirm.doneTx',{count:r.saved}):t('imp.confirm.doneTransfers',{count:r.transfers}));
  return true;
}

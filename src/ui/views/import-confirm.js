/**
 * ui/views/import-confirm.js
 * Responsibility: the explicit confirmation before anything is saved, and the save itself. Shows how many
 * items and the totals, runs the domain command through runCommand (rollback if the browser cannot
 * save), blocks a second tap while saving, and stores the result per item for the result screen.
 */
import { esc } from '../../core/dom.js';
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
  if(!sel.count&&!ov.transfers){toast('⚠️ Marque pelo menos um lançamento');return false;}
  const toCheck=s.drafts.filter(d=>d.selected&&needsReview(d)).length,possible=s.drafts.filter(d=>d.selected&&d.dup).length;
  s.busy=true;
  const what=sel.count?`${sel.count} lançamento${sel.count>1?'s':''}`:`${ov.transfers} transferência${ov.transfers>1?'s':''}`;
  const yes=await askConfirm({title:`Importar ${what}?`,ok:sel.count?`Importar ${sel.count}`:'Guardar',
    html:`<div>Receitas: <b>${f2(sel.income)}</b><br>Despesas: <b>${f2(sel.expense)}</b><br>${sel.contribution?`Aportes: <b>${f2(sel.contribution)}</b><br>`:''}${sel.count?`Meses: <b>${sel.months.map(m=>esc(mShort(m))).join(', ')}</b>`:''}${ov.transfers?`<br>Transferências entre suas contas: <b>${ov.transfers}</b> (${f2(ov.transferTotal)}), não contam como receita nem despesa`:''}</div>
      ${toCheck?`<div class="bd-note mt-10">${toCheck} item(ns) sem categoria ou com alerta: os sem categoria vão para “Imprevistos / Outros” (despesa) ou “Outros” (receita).</div>`:''}
      ${possible?`<div class="bd-note mt-10">${possible} item(ns) marcado(s) parecem repetidos: você escolheu importar mesmo assim.</div>`:''}
      ${ov.pairFixes?`<div class="bd-note mt-10">${ov.pairFixes} lançamento(s) já salvo(s) vão virar transferência (você pediu para corrigir as duas pontas).</div>`:'<div class="mut mt-10">Nada do que já existe será alterado ou apagado.</div>'}`});
  if(!yes){s.busy=false;return false;}
  const r=runCommand(()=>commitImport(s.drafts,{fileHash:s.read.fileHash,fileName:s.read.fileName,at:today()}),{render:false});
  s.busy=false;
  if(!r)return false; // saving failed: nothing changed and the review is still here
  s.snapshot=s.drafts.map(d=>({id:d.id,desc:d.desc,value:d.value}));
  s.result=r;keepUnsaved(r.items);s.phase='result';
  if(r.months.length)ui.cur=r.months[r.months.length-1];
  render();toast(r.saved?`✅ ${r.saved} lançamento${r.saved===1?'':'s'} importado${r.saved===1?'':'s'}`:`✅ ${r.transfers} transferência${r.transfers===1?'':'s'} guardada${r.transfers===1?'':'s'}`);
  return true;
}

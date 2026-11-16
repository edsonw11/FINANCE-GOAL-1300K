/**
 * ui/views/import-custody-view.js
 * Responsibility: the screen shown when the file is a broker custody statement: the balance it reports,
 * the account to update and the comparison with what the app has today. Confirms, then applies it as a
 * balance snapshot through the domain command. No transaction is created.
 */
import { $, esc } from '../../core/dom.js';
import { f2 } from '../../core/format.js';
import { formatDateBR } from '../../core/dates.js';
import { active, accName } from '../../domain/accounts.js';
import { applyCustody, currentBalance } from '../../domain/import-custody.js';
import { askConfirm } from '../components/confirm.js';
import { runCommand } from '../components/command.js';
import { Sheet } from '../components/sheet.js';
export function custodyHtml(s){
  const c=s.custody,now=s.acc?currentBalance(s.acc,c.date):null;
  return `<div class="imp-banner">🔎 <b>Extrato de custódia:</b> é o saldo em ${formatDateBR(c.date)}, não uma lista de movimentações. Nenhum aporte ou gasto será criado.</div>
    <div class="imp-file"><b>${esc(s.file.name)}</b></div>
    <div class="imp-tiles">
      <div><span>Saldo bruto</span><b>${f2(c.gross)}</b></div>
      <div><span>IR estimado</span><b>${f2(c.ir)}</b></div>
      <div><span>IOF</span><b>${f2(c.iof)}</b></div>
      <div><span>Saldo líquido</span><b class="rec">${f2(c.net)}</b></div>
    </div>
    <div class="formgrid"><div class="span-all"><label>Atualizar o saldo de</label>
      <select id="cuAcc"><option value="">Escolha a conta…</option>${active().map(a=>`<option value="${a.id}"${s.acc===a.id?' selected':''}>${esc(a.name)}</option>`).join('')}</select></div></div>
    ${now!==null?`<div class="help">Hoje o app mostra <b>${f2(now)}</b> para ${esc(accName(s.acc))} nessa data. Depois: <b>${f2(c.net)}</b> (líquido).</div>`:''}`;
}
export function bindCustody(s,body,foot){
  foot.innerHTML='<button type="button" class="btn" id="cuCancel">Cancelar</button><button type="button" class="btn pri" id="cuGo">Atualizar saldo</button>';
  const go=$('cuGo');go.disabled=!s.acc;
  $('cuCancel').onclick=()=>Sheet.close();
  $('cuAcc').onchange=e=>{s.acc=e.target.value;Sheet.refresh();};
  go.onclick=async()=>{
    const c=s.custody,yes=await askConfirm({title:'Atualizar saldo?',ok:'Atualizar',
      html:`<div>${esc(accName(s.acc))} em <b>${formatDateBR(c.date)}</b><br>Saldo líquido: <b>${f2(c.net)}</b><br>Saldo bruto: <b>${f2(c.gross)}</b></div><div class="mut mt-10">Se já existir um saldo dessa conta nesse dia, ele é substituído. Lançamentos não são alterados.</div>`});
    if(!yes)return;
    const r=runCommand(()=>applyCustody(c,s.acc),{ok:'Saldo atualizado ✅'});
    if(r)Sheet.close();
  };
}

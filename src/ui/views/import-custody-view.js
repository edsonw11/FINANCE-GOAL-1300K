/**
 * ui/views/import-custody-view.js
 * Responsibility: the screen shown when the file is a broker custody statement: the balance it reports,
 * the account to update (or a new one, with the name suggested from the statement) and the comparison with
 * what the app has today. Confirms, then applies it as a balance snapshot through the domain command.
 * No transaction is created.
 */
import { $, esc } from '../../core/dom.js';
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
  return `<div class="imp-banner">🔎 <b>Extrato de custódia:</b> é o saldo em ${formatDateBR(c.date)}, não uma lista de movimentações. Nenhum aporte ou gasto será criado.</div>
    <div class="imp-file"><b>${esc(s.file.name)}</b></div>
    <div class="imp-tiles">
      <div><span>Saldo bruto</span><b>${f2(c.gross)}</b></div>
      <div><span>IR estimado</span><b>${f2(c.ir)}</b></div>
      <div><span>IOF</span><b>${f2(c.iof)}</b></div>
      <div><span>Saldo líquido</span><b class="rec">${f2(c.net)}</b></div>
    </div>
    <div class="formgrid"><div class="span-all"><label>Atualizar o saldo de</label>
      <select id="cuAcc"><option value=""${!s.acc?' selected':''}>Escolha a conta…</option>${active().map(a=>`<option value="${a.id}"${s.acc===a.id?' selected':''}>${esc(a.name)}</option>`).join('')}<option value="${NEW_ACCOUNT}"${isNew(s)?' selected':''}>➕ Criar conta nova</option></select></div>
      ${isNew(s)?`<div class="span-all"><label for="cuNew">Nome da conta nova</label><input id="cuNew" value="${esc(s.newName)}" placeholder="Ex.: Nubank Caixinhas"></div>`:''}</div>
    ${!active().length?'<div class="help">Você ainda não tem conta de investimento: crie uma aqui e o saldo já entra nela.</div>':''}
    ${now!==null?`<div class="help">Hoje o app mostra <b>${f2(now)}</b> para ${esc(accName(s.acc))} nessa data. Depois: <b>${f2(c.net)}</b> (líquido).</div>`:''}`;
}
export function bindCustody(s,body,foot){
  foot.innerHTML='<button type="button" class="btn" id="cuCancel">Cancelar</button><button type="button" class="btn pri" id="cuGo">Atualizar saldo</button>';
  const go=$('cuGo'),ready=()=>isNew(s)?!!s.newName.trim():!!s.acc;go.disabled=!ready();
  $('cuCancel').onclick=()=>Sheet.close();
  $('cuAcc').onchange=e=>{s.acc=e.target.value;Sheet.refresh();};
  const nm=$('cuNew');if(nm)nm.oninput=()=>{s.newName=nm.value;go.disabled=!ready();};
  go.onclick=async()=>{
    const c=s.custody,yes=await askConfirm({title:'Atualizar saldo?',ok:'Atualizar',
      html:`<div>${isNew(s)?'Conta nova <b>'+esc(s.newName.trim())+'</b>':esc(accName(s.acc))} em <b>${formatDateBR(c.date)}</b><br>Saldo líquido: <b>${f2(c.net)}</b><br>Saldo bruto: <b>${f2(c.gross)}</b></div><div class="mut mt-10">Se já existir um saldo dessa conta nesse dia, ele é substituído. Lançamentos não são alterados.</div>`});
    if(!yes)return;
    const r=isNew(s)?runCommand(()=>applyCustodyToNewAccount(c,s.newName),{ok:'Conta criada e saldo atualizado ✅'})
      :runCommand(()=>applyCustody(c,s.acc),{ok:'Saldo atualizado ✅'});
    if(r)Sheet.close();
  };
}

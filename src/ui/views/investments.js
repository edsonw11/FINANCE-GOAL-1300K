/**
 * ui/views/investments.js
 * Responsibility: Investments tab: accounts and balances.
 */
import { $, esc } from '../../core/dom.js';
import { f2, m2, pc } from '../../core/format.js';
import { formatDateBR, mShort, today } from '../../core/dates.js';
import { parseMoney } from '../../core/money.js';
import { S } from '../../domain/store.js';
import { active, balance, total, totalGross } from '../../domain/accounts.js';
import { realSeries } from '../../domain/investments.js';
import { addAccount, archiveAccount, saveSnapshots } from '../../domain/account-commands.js';
import { accColor } from '../account-colors.js';
import { askConfirm } from '../components/confirm.js';
import { fieldError } from '../components/field-error.js';
import { runCommand } from '../components/command.js';
export function renderInvestments(){
  const d=today();
  $('accList').innerHTML=active().map(a=>{const b=balance(a.id,d);const sn=b.snap;
    const sub=sn?`Saldo informado em ${formatDateBR(sn.date)}${sn.est?' (estimado 🟠)':''}${b.v!==sn.value?' + aportes depois':''}`:'Sem saldo informado';
    return `<div class="acc"><i style="background:${accColor(a.id)}"></i><div class="nm">${esc(a.name)}<span class="sb">${sub}</span></div><button class="btn sm" data-arq="${a.id}" title="Remover da lista (o histórico é mantido)">arquivar</button><div class="vl r">${f2(b.v)}<span class="sb fw5">${b.g!==null?'bruto '+f2(b.g)+' · IR '+f2(b.g-b.v):'bruto não informado'}</span></div></div>`;}).join('')+
    (()=>{const tg=totalGross(d);return `<div class="acc"><i class="swatch-total"></i><div class="nm">Total<span class="sb">líquido (o que você recebe ao resgatar)</span></div><div class="vl r">${f2(total(d))}<span class="sb fw5">${tg.ok?'':'≈ '}bruto ${f2(tg.g)} · IR embutido ${f2(tg.g-total(d))}</span></div></div>`;})();
  $('snapForm').innerHTML=`<div class="snap-grid help"><span></span><b>Saldo líquido (R$)</b><b>Saldo bruto (R$, opcional)</b></div>`+
    active().map(a=>{const b=balance(a.id,d);return `<div class="snap-grid c"><label for="s_${a.id}" class="m0"><i class="swatch" style="background:${accColor(a.id)}"></i>${esc(a.name)}</label><input id="s_${a.id}" inputmode="decimal" value="${m2(b.v)}"><input id="g_${a.id}" inputmode="decimal" placeholder="igual ao do app" value="${b.g!==null?m2(b.g):''}"></div>`;}).join('');
  $('snapDate').value=d;
  const real=realSeries();
  $('histTbl').innerHTML=`<tr><th>Mês</th><th>Patrimônio</th><th>Aportes</th><th>Rendimento</th><th>% no mês</th><th>Esperado</th></tr>`+
    [...real].reverse().map(r=>{const exp=r.prev!==null?r.prev*(Math.pow(1+S.rate/100,1/12)-1):null;
      const cls=r.y===null?'':(r.y>=exp?'pos':'neg');
      return `<tr><td>${mShort(r.m)}</td><td>${f2(r.t)}</td><td>${r.ap?f2(r.ap):'—'}</td><td class="${cls}">${r.y===null?'—':f2(r.y)}</td><td class="${cls}">${r.y===null?'—':pc(r.y/r.prev)}</td><td class="mut">${exp===null?'—':f2(exp)}</td></tr>`;}).join('');
}
export function bindInvestments(){
$('snapSave').onclick=()=>{const d=$('snapDate').value;if(!d)return fieldError($('snapDate'),'Escolha a data dos saldos');
  const rows=active().map(a=>({acc:a.id,value:parseMoney($('s_'+a.id).value),gross:parseMoney($('g_'+a.id).value)}));
  runCommand(()=>saveSnapshots(d,rows),{ok:'✅ Saldos salvos em '+formatDateBR(d)});};
$('accList').onclick=e=>{const b=e.target.closest('[data-arq]');if(!b)return;const a=S.accounts.find(x=>x.id===b.dataset.arq);
  if(Math.abs(balance(a.id,today()).v)>0.005)return runCommand(()=>archiveAccount(a.id)); // shows why it cannot be archived
  askConfirm({title:'Arquivar conta',text:'Arquivar '+a.name+'? Ela sai das listas, mas o histórico dos meses anteriores é mantido.',ok:'Arquivar'})
    .then(r=>{if(r)runCommand(()=>archiveAccount(a.id),{ok:a.name+' arquivada'});});};
$('addAcc').onclick=()=>{if(runCommand(()=>addAccount($('newAcc').value),{ok:'Conta adicionada. Informe o saldo em “Atualizar saldos”.'}))$('newAcc').value='';};
}

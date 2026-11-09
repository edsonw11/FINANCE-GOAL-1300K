/**
 * ui/views/ajustes.js
 * Responsibility: Settings tab: assumptions, card, accounts and backup.
 */
function renderSettings(){
  if(document.activeElement!==$('goal'))$('goal').value=m2(S.goal);
  if(document.activeElement!==$('rate'))$('rate').value=String(S.rate).replace('.',',');
  $('cClose').value=CARD().best;$('cBiz').checked=CARD().biz!==false;$('cDue').value=CARD().due;
  if(document.activeElement!==$('planned'))$('planned').value=m2(S.planned);
  const real=realSeries(),av=avgContribution(real);
  $('avgHelp').innerHTML=`Sua média real de aportes: <b>${f0(av)}/mês</b> ${av>0?'<button class="btn sm" id="useAvg">usar na projeção</button>':''}`;
  const b=$('useAvg');if(b)b.onclick=()=>{S.planned=Math.round(av);save();render();toast('Projeção usando '+f0(av)+'/mês');};
  const est=S.snaps.filter(s=>s.est);
  $('estNote').style.display=est.length?'':'none';
  $('estNote').innerHTML=`🟠 Alguns saldos iniciais são <b>estimados</b> (${est.map(s=>esc(accName(s.acc))).join(', ')}). Em Investimentos, use “Atualizar saldos” com os valores líquidos reais para substituí-los.`;
}
function renderBackup(){renderDemo();
  const t=+localStorage.getItem('metaapp.lastBackup')||0,days=(Date.now()-t)/864e5;
  $('bkNote').innerHTML=days>14?`<div class="banner"><span>${t?'Seu último backup foi há '+Math.floor(days)+' dias.':'Você ainda não fez backup.'} Os dados ficam só neste navegador.</span><button class="btn sm pri" id="bkNow">Fazer backup agora</button></div>`:'';
  const b=$('bkNow');if(b)b.onclick=()=>$('exp').click();
}
function bindSettings(){
$('snapSave').onclick=()=>{const d=$('snapDate').value;if(!d)return toast('⚠️ Escolha a data');
  active().forEach(a=>{const v=parse($('s_'+a.id).value),g=parse($('g_'+a.id).value);
    S.snaps=S.snaps.filter(s=>!(s.acc===a.id&&s.date===d));const sn={date:d,acc:a.id,value:v,est:false};if(g>0)sn.gross=g;S.snaps.push(sn);});
  save();render();toast('✅ Saldos salvos em '+formatDateBR(d));};
$('accList').onclick=e=>{const b=e.target.closest('[data-arq]');if(!b)return;const a=S.accounts.find(x=>x.id===b.dataset.arq);
  if(Math.abs(balance(a.id,today()).v)>0.005)return toast('⚠️ Primeiro zere o saldo de '+a.name+' em “Atualizar saldos” (e some o valor na conta que recebeu).');
  if(confirm('Arquivar '+a.name+'? Ela sai das listas, mas o histórico dos meses anteriores é mantido.')){a.archived=true;save();render();toast(a.name+' arquivada');}};
$('addAcc').onclick=()=>{const n=$('newAcc').value.trim();if(!n)return;S.accounts.push({id:'a'+(S.nid++),name:n});$('newAcc').value='';save();render();toast('Conta adicionada. Informe o saldo em “Atualizar saldos”.');};
['cClose','cDue','cBiz'].forEach(id=>$(id).onchange=()=>{const c=Math.min(Math.max(Math.round(parse($('cClose').value))||1,1),31),d=Math.min(Math.max(Math.round(parse($('cDue').value))||7,1),31);S.card={best:c,due:d,biz:$('cBiz').checked,over:CARD().over||{},v3:true};save();render();toast('Cartão: melhor dia de compra '+c+' e vencimento dia '+d);});
['goal','rate','planned'].forEach(id=>$(id).onchange=()=>{S.goal=parse($('goal').value)||1300000;S.rate=parse($('rate').value);S.planned=parse($('planned').value);save();render();});
$('printBtn').onclick=()=>window.print();
$('exp').onclick=()=>{localStorage.setItem('metaapp.lastBackup',String(Date.now()));renderBackup();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='meta1300k-backup.json';a.click();};
$('imp').onclick=()=>$('file').click();
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{let d=JSON.parse(rd.result);
  if(d.v!==2){ // old format (tracker)
    if(!d.entries)throw 0;const n=seed();n.goal=d.goal||n.goal;n.rate=d.rate||n.rate;n.planned=d.planned||0;n.snaps=[];n.tx=[];
    Object.keys(d.entries).sort().forEach(k=>{const e=d.entries[k];e.bal.forEach((v,i)=>{if(n.accounts[i])n.snaps.push({date:monthEnd(k),acc:n.accounts[i].id,value:v,est:!!e.est});});
      e.ap.forEach((v,i)=>{if(v>0&&n.accounts[i])n.tx.push({id:n.nid++,date:k+'-15',type:'aporte',acc:n.accounts[i].id,value:v,desc:'importado'});});});
    d=n;toast('Backup antigo convertido. Confira os saldos em Investimentos.');}
  S=d;save();render();}catch(x){toast('⚠️ Arquivo inválido');}};rd.readAsText(f);};
$('reset').onclick=()=>{if(confirm('Apagar todos os dados e voltar ao estado inicial?')){S=seed();save();render();}};
}

/**
 * ui/views/projecao.js
 * Responsibility: Projection tab: scenarios and month-by-month table.
 */
function renderProj(real,hit){
  const last=real[real.length-1],goal=S.goal,ap=S.planned;
  const m=Math.pow(1+S.rate/100,1/12)-1,rc=Math.max(S.rate-2,0),mc=Math.pow(1+rc/100,1/12)-1;
  const N=Math.min(Math.max((hit>0?hit+3:12),12),48);
  let b=last.t,bc=last.t,cum=0,hitRow=false;const baseA=[],consA=[];
  let rows=`<tr><th>Mês</th><th>Saldo inicial</th><th>Juros do mês</th><th>Aporte</th><th>Saldo final</th><th>% da meta</th><th>Falta p/ meta</th><th title="Mesmo plano, mas com a taxa 2 pontos percentuais menor">Se juros caírem</th></tr>`+
    `<tr><td><b>Hoje</b></td><td>—</td><td>—</td><td>—</td><td><b>${f0(last.t)}</b></td><td>${pc(Math.min(last.t/goal,1))}</td><td>${last.t>=goal?'✅':f0(goal-last.t)}</td><td class="mut">${f0(last.t)}</td></tr>`;
  for(let n=1;n<=N;n++){
    const ini=b,jur=ini*m;b=ini+jur+ap;bc=bc*(1+mc)+ap;cum+=jur;baseA.push(b);consA.push(bc);
    const reached=b>=goal,first=reached&&!hitRow;if(reached)hitRow=true;
    rows+=`<tr${first?' style="background:color-mix(in srgb,var(--rec) 13%,var(--card))"':''}><td>${mShort(mKey(mIdx(last.m)+n))}${first?' ✅':''}</td><td>${f0(ini)}</td><td class="pos">+ ${f0(jur)}</td><td>${ap?'+ '+f0(ap):'—'}</td><td><b>${f0(b)}</b></td><td>${pc(Math.min(b/goal,1))}</td><td>${reached?'✅ atingida':f0(goal-b)}</td><td class="mut">${f0(bc)}${bc>=goal?' ✅':''}</td></tr>`;
  }
  $('projTbl').innerHTML=rows;drawProj(real,baseA,consA,rc);
  $('projHelp').innerHTML=`Juros sobre juros: cada mês rende sobre o saldo do mês anterior, já com os juros acumulados. Taxa: <b>${String(S.rate).replace('.',',')}% a.a. líquido</b> (${pc(m)} ao mês) e aporte de <b>${f0(ap)}/mês</b>. A coluna “Se juros caírem” usa ${String(rc).replace('.',',')}% a.a. Valores líquidos, partindo do saldo de hoje.`;
}

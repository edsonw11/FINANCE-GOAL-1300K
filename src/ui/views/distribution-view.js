/**
 * ui/views/distribution-view.js
 * Responsibility: the "Distribuição dos investimentos" card: a ring with the share of each part of the net worth,
 * two ways to look at it (by account or by type: fixed income, stocks, FIIs, ETFs). Each slice has a line to its
 * name and percentage (no separate legend). Tapping a slice or its label highlights it and shows its value in the middle. Read only; numbers come from the domain.
 */
import { $, esc } from '../../core/dom.js';
import { f0, pc } from '../../core/format.js';
import { DIST_OTHER_ID, investmentDistribution } from '../../domain/investments.js';
import { donutSvg } from '../charts/donut-chart.js';
import { accColor, typeColor } from '../account-colors.js';
import { allocationStatus, clearTargets, setTarget } from '../../domain/allocation.js';
import { runCommand } from '../components/command.js';
import { css } from '../../core/dom.js';
// compactMoney money for the middle of a small ring: R$ 1,25 mi, R$ 124 mil
const compactMoney=v=>v>=1e6?'R$ '+(v/1e6).toFixed(2).replace('.',',')+' mi':v>=1e4?'R$ '+Math.round(v/1e3)+' mil':f0(v);
const view={by:'account',sel:null};
const colorOf=i=>i.id===DIST_OTHER_ID?css('--mut')||'#9aa5ba':view.by==='type'?typeColor(i.id):accColor(i.id);
const tabs=()=>`<div class="dist-tabs" role="tablist">${[['account','Por conta'],['type','Por tipo']].map(([k,l])=>`<button type="button" role="tab" aria-selected="${view.by===k}" class="dist-tab${view.by===k?' on':''}" data-dist-by="${k}">${l}</button>`).join('')}</div>`;
const GAP_TEXT={on:()=>'✅ no alvo',over:r=>'acima: tirar '+f0(-r.money),under:r=>'abaixo: faltam '+f0(r.money),none:()=>''};
// optional target per type: where I am, where I want to be, and the difference in money
function targetsHtml(){
  const st=allocationStatus(),rows=st.rows.map(r=>`<div class="tg-row ${r.level}"><span class="tg-n"><i style="background:${typeColor(r.id)}"></i>${esc(r.name)}</span><span class="tg-now">${pc(r.share)}</span><label class="tg-in"><span class="sr-only">Meta de ${esc(r.name)} (%)</span><input inputmode="decimal" data-target="${r.id}" value="${r.target?String(Math.round(r.target*1000)/10).replace('.',','):''}" placeholder="meta %"></label><span class="tg-gap">${GAP_TEXT[r.level](r)}</span></div>`).join('');
  return `<div class="tg"><h3 class="m0">Minha alocação ideal <span class="mut tg-opt">(opcional)</span></h3><div class="help">Diga quanto de cada tipo você quer ter. O app mostra a diferença em reais, sem mexer em nada.</div>${rows}${st.targeted?'<button type="button" class="btn sm" data-target-clear>Limpar metas</button>':''}</div>`;
}
export function renderDistribution(){
  const el=$('distCard');if(!el)return;
  const d=investmentDistribution(undefined,view.by);
  if(!d.items.length){el.innerHTML='<div class="help">Sem saldo nos investimentos ainda. Atualize os saldos abaixo (ou importe um extrato de custódia) e a distribuição aparece aqui.</div>';return;}
  if(view.sel&&!d.items.some(i=>i.id===view.sel))view.sel=null;
  const pick=d.items.find(i=>i.id===view.sel);
  const slices=d.items.map(i=>({value:i.value,color:colorOf(i),key:i.id,dim:!!pick&&pick.id!==i.id,name:i.name+(i.count>1&&view.by==='type'?' ('+i.count+')':''),text:pc(i.share)}));
  const narrow=window.innerWidth<=640;
  el.innerHTML=`${tabs()}${donutSvg(slices,{compact:narrow,width:Math.min(window.innerWidth-56,600),
      centerTop:(narrow?compactMoney:f0)(pick?pick.value:d.total),centerBottom:pick?esc(pick.name):'total',ariaLabel:'Distribuição dos investimentos: '+d.items.map(i=>i.name+' '+pc(i.share)).join(', ')})}${view.by==='type'?targetsHtml():''}`;
}
export function bindDistribution(){
  const el=$('distCard');if(!el)return;
  const choose=key=>{view.sel=view.sel===key?null:key;renderDistribution();};
  el.onclick=e=>{
    const t=e.target.closest('[data-dist-by]');if(t){view.by=t.dataset.distBy;view.sel=null;renderDistribution();return;}
    if(e.target.closest('[data-target-clear]'))return runCommand(()=>clearTargets(),{ok:'Metas removidas'});
    const k=e.target.closest('[data-key]');if(k)choose(k.dataset.key);};
  el.onchange=e=>{const i=e.target.closest('[data-target]');if(i)runCommand(()=>setTarget(i.dataset.target,parseFloat(String(i.value).replace(',','.'))||0),{ok:'Meta salva'});};
}

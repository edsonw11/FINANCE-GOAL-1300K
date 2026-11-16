/**
 * ui/charts/tower-chart.js
 * Responsibility: Tower chart (real and projected net worth).
 */
import { $, css, esc } from '../../core/dom.js';
import { f0, f2 } from '../../core/format.js';
import { mLabel, mShort } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { TYPE_ORDER, typeOfAccount } from '../../domain/investments.js';
import { typeColor } from '../account-colors.js';
import { chartWidth, rr } from './chart-utils.js';
// balances of the accounts added up by investment type, in the fixed stacking order (only types with money)
const TYPE_NAME={};
function byType(bal){
  const sums={};
  S.accounts.forEach((a,n)=>{if(!(bal[n]>0))return;const t=typeOfAccount(a.name);TYPE_NAME[t.id]=t.name;sums[t.id]=(sums[t.id]||0)+bal[n];});
  return TYPE_ORDER.filter(id=>sums[id]>0).map(id=>[id,sums[id]]);
}
export function drawTower(real,proj,hit){
  const goal=S.goal,all=real.concat(proj),N=all.length;
  const W=chartWidth($('chTower'),980,240),narrow=W<640,H=narrow?300:410,L=narrow?44:70,R=narrow?8:14,T=30,B=46,pw=W-L-R,ph=H-T-B;
  const ymax=Math.max(goal*1.1,...all.map(a=>a.t))*1.02,y=v=>T+ph-v/ymax*ph,bw=pw/N,w=Math.min(bw*0.7,48),step=ymax>1.5e6?5e5:2e5;
  const last=real[real.length-1];
  let s=`<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${css('--proj')}" fill-opacity=".3"/><line x1="0" y1="0" x2="0" y2="7" stroke="${css('--proj')}" stroke-width="3"/></pattern></defs>`;
  for(let g=0;g<=ymax;g+=step)s+=`<line x1="${L}" x2="${W-R}" y1="${y(g)}" y2="${y(g)}" stroke="${css('--line')}"/><text x="${L-8}" y="${y(g)+4}" text-anchor="end" font-size="12" fill="${css('--muted')}">${g?(g/1e6).toFixed(1).replace('.',',')+' M':'0'}</text>`;
  const every=Math.ceil(N/(narrow?Math.max(3,Math.floor(W/70)):13));
  all.forEach((r,j)=>{
    const x=L+j*bw+(bw-w)/2,isReal=j<real.length;
    if(isReal){let acc=0;const nz=byType(r.bal);
      nz.forEach(([id,v],q)=>{const yt=y(acc+v),h=y(acc)-yt-(q>0?2:0);s+=`<path d="${rr(x,yt,w,Math.max(h,1),q===nz.length-1?4:0)}" fill="${typeColor(id)}"/>`;acc+=v;});
      const lab=!narrow&&(bw>=34||j%Math.ceil(34/bw)===0||j===real.length-1);
      if(r.ap>0&&lab&&bw>=34)s+=`<text x="${x+w/2}" y="${y(r.t)-23}" text-anchor="middle" font-size="11" font-weight="700" fill="${css('--apo')}">+${(r.ap/1000).toFixed(r.ap<10000?1:0).replace('.',',')}k</text>`;
      if(narrow?j===real.length-1:lab)s+=`<text x="${x+w/2}" y="${y(r.t)-9}" text-anchor="${narrow?'start':'middle'}" font-size="12" font-weight="700" fill="${css('--ink')}">${(r.t/1e6).toFixed(3).replace('.',',')}</text>`;
    } else {s+=`<path d="${rr(x,y(r.t),w,y(0)-y(r.t),4)}" fill="url(#hatch)" stroke="${css('--proj')}" stroke-width="1.5"/>`;
      if(hit>0&&j===real.length-1+hit)s+=`<text x="${x+w/2}" y="${y(r.t)-9}" text-anchor="middle" font-size="13" font-weight="700" fill="${css('--rec')}">✅ ${(r.t/1e6).toFixed(3).replace('.',',')}</text>`;}
    if(j%every===0||(hit>0&&j===real.length-1+hit))s+=`<text x="${x+w/2}" y="${H-B+18}" text-anchor="middle" font-size="12" fill="${css('--ink2')}">${mShort(r.m)}</text>`;
    s+=`<rect class="hit" data-j="${j}" x="${L+j*bw}" y="${T}" width="${bw}" height="${ph}" fill="transparent"/>`;
  });
  s+=`<line x1="${L}" x2="${W-R}" y1="${y(goal)}" y2="${y(goal)}" stroke="${css('--meta')}" stroke-width="2.5" stroke-dasharray="7 5"/><text x="${L+4}" y="${y(goal)-7}" font-size="13" font-weight="700" fill="${css('--meta')}">🎯 Meta ${f0(goal)}</text>`;
  const svg=$('chTower');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=s;
  const tip=$('tip'),box=$('box');
  svg.querySelectorAll('.hit').forEach(el=>{
    el.onmousemove=e=>{const j=+el.dataset.j,r=all[j];let h;
      if(j<real.length)h=`<b>${mLabel(r.m)}</b><br>Total: ${f2(r.t)}<br>`+byType(r.bal).map(([id,v])=>`${esc(TYPE_NAME[id])}: ${f0(v)}`).join('<br>')+(r.ap?`<br>🏦 Aportes: ${f0(r.ap)}`:'')+`<br>Falta: ${f0(Math.max(goal-r.t,0))}`;
      else h=`<b>${mLabel(r.m)}</b> · projeção<br>Total: ${f0(r.t)}<br>${r.t>=goal?'✅ meta atingida':'Falta: '+f0(goal-r.t)}`;
      tip.innerHTML=h;const bb=box.getBoundingClientRect();tip.style.left=Math.max(0,Math.min(e.clientX-bb.left+14,bb.width-240))+'px';tip.style.top=(e.clientY-bb.top+14)+'px';tip.style.opacity=1;};
    el.onclick=el.onmousemove;el.onmouseleave=()=>tip.style.opacity=0;});
  const used=TYPE_ORDER.filter(id=>real.some(r=>byType(r.bal).some(([t])=>t===id)));
  $('lgTower').innerHTML=used.map(id=>`<span><i style="background:${typeColor(id)}"></i>${esc(TYPE_NAME[id])}</span>`).join('')+
    `<span><i class="lg-proj"></i>Projeção</span><span><i class="lg-line lg-goal"></i>Meta</span>`;
}

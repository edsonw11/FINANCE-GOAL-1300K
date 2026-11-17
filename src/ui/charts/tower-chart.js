/**
 * ui/charts/tower-chart.js
 * Responsibility: the one Patrimônio chart: real net worth by investment type (stacked bars), the
 * projection (hatched bars), the "se juros caírem" line and the goal. The scale fits the data;
 * when the goal is far above it, the goal is a label instead of a line pressed against the top.
 */
import { $, css, esc } from '../../core/dom.js';
import { f0, f2 } from '../../core/format.js';
import { mLabel, mShort } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { TYPE_ORDER, typeOfAccount } from '../../domain/investments.js';
import { typeColor } from '../account-colors.js';
import { chartScale, lowerRate } from '../../domain/goal-projection.js';
import { chartWidth, rr } from './chart-utils.js';
// balances of the accounts added up by investment type, in the fixed stacking order (only types with money)
const TYPE_NAME={};
function byType(bal){
  const sums={};
  S.accounts.forEach((a,n)=>{if(!(bal[n]>0))return;const t=typeOfAccount(a.name);TYPE_NAME[t.id]=t.name;sums[t.id]=(sums[t.id]||0)+bal[n];});
  return TYPE_ORDER.filter(id=>sums[id]>0).map(id=>[id,sums[id]]);
}
// 1, 2 or 5 times a power of ten, about four lines on the axis
function niceStep(max){const raw=max/4,p=Math.pow(10,Math.floor(Math.log10(raw||1))),k=raw/p;return (k<=1?1:k<=2?2:k<=5?5:10)*p;}
const axisText=v=>!v?'0':v>=1e6?(v/1e6).toFixed(v%1e6?1:0).replace('.',',')+' M':Math.round(v/1e3)+' mil';
const barText=v=>v>=1e6?(v/1e6).toFixed(2).replace('.',',')+' M':Math.round(v/1e3)+' mil';
export function drawTower(real,rows){
  const proj=rows.map(r=>({m:r.m,t:r.end,low:r.low,first:r.first}));
  const goal=S.goal,all=real.concat(proj),N=all.length,nReal=real.length;
  const W=chartWidth($('chTower'),980,240),narrow=W<640,H=narrow?300:410,L=narrow?60:74,R=narrow?8:14,T=30,B=46,pw=W-L-R,ph=H-T-B;
  const sc=chartScale(all.map(a=>a.t),goal),ymax=sc.max,y=v=>T+ph-v/ymax*ph,bw=pw/N,w=Math.min(bw*0.7,48),step=niceStep(ymax);
  const last=real[real.length-1];
  let s=`<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${css('--proj')}" fill-opacity=".3"/><line x1="0" y1="0" x2="0" y2="7" stroke="${css('--proj')}" stroke-width="3"/></pattern></defs>`;
  for(let g=0;g<=ymax;g+=step)s+=`<line x1="${L}" x2="${W-R}" y1="${y(g)}" y2="${y(g)}" stroke="${css('--line')}"/><text x="${L-8}" y="${y(g)+4}" text-anchor="end" font-size="12" fill="${css('--muted')}">${axisText(g)}</text>`;
  const every=Math.ceil(N/(narrow?Math.max(3,Math.floor(W/70)):13));
  all.forEach((r,j)=>{
    const x=L+j*bw+(bw-w)/2,isReal=j<real.length;
    if(isReal){let acc=0;const nz=byType(r.bal);
      nz.forEach(([id,v],q)=>{const yt=y(acc+v),h=y(acc)-yt-(q>0?2:0);s+=`<path d="${rr(x,yt,w,Math.max(h,1),q===nz.length-1?4:0)}" fill="${typeColor(id)}"/>`;acc+=v;});
      const lab=!narrow&&(bw>=34||j%Math.ceil(34/bw)===0||j===real.length-1);
      if(r.ap>0&&lab&&bw>=34)s+=`<text x="${x+w/2}" y="${y(r.t)-23}" text-anchor="middle" font-size="11" font-weight="700" fill="${css('--apo')}">+${(r.ap/1000).toFixed(r.ap<10000?1:0).replace('.',',')}k</text>`;
      if(narrow?j===real.length-1:lab)s+=`<text x="${x+w/2}" y="${y(r.t)-9}" text-anchor="${narrow?'start':'middle'}" font-size="12" font-weight="700" fill="${css('--ink')}">${barText(r.t)}</text>`;
    } else {s+=`<path d="${rr(x,y(r.t),w,y(0)-y(r.t),4)}" fill="url(#hatch)" stroke="${css('--proj')}" stroke-width="1.5"/>`;
      if(r.first)s+=`<text x="${x+w/2}" y="${y(r.t)-9}" text-anchor="middle" font-size="13" font-weight="700" fill="${css('--rec')}">✅ ${barText(r.t)}</text>`;}
    if(j%every===0||r.first)s+=`<text x="${x+w/2}" y="${H-B+18}" text-anchor="middle" font-size="12" fill="${css('--ink2')}">${mShort(r.m)}</text>`;
    s+=`<rect class="hit" data-j="${j}" x="${L+j*bw}" y="${T}" width="${bw}" height="${ph}" fill="transparent"/>`;
  });
  // "se juros caírem": from today's bar through the projected months
  if(proj.length){const cx=j=>L+j*bw+bw/2,pts=[[cx(nReal-1),y(real[nReal-1].t)]].concat(proj.map((p,k)=>[cx(nReal+k),y(p.low)]));
    s+=`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${css('--warn')}" stroke-width="2.5" stroke-dasharray="3 5" stroke-linecap="round"/>`;}
  s+=sc.goalInside?`<line x1="${L}" x2="${W-R}" y1="${y(goal)}" y2="${y(goal)}" stroke="${css('--meta')}" stroke-width="2.5" stroke-dasharray="7 5"/><text x="${L+4}" y="${y(goal)-7}" font-size="13" font-weight="700" fill="${css('--meta')}">🎯 Meta ${f0(goal)}</text>`
    :`<text x="${W-R}" y="${T-12}" text-anchor="end" font-size="13" font-weight="700" fill="${css('--meta')}">🎯 Meta ${f0(goal)} ↑ acima da escala</text>`;
  const svg=$('chTower');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=s;
  const tip=$('tip'),box=$('box');
  svg.querySelectorAll('.hit').forEach(el=>{
    el.onmousemove=e=>{const j=+el.dataset.j,r=all[j];let h;
      if(j<real.length)h=`<b>${mLabel(r.m)}</b><br>Total: ${f2(r.t)}<br>`+byType(r.bal).map(([id,v])=>`${esc(TYPE_NAME[id])}: ${f0(v)}`).join('<br>')+(r.ap?`<br>🏦 Aportes: ${f0(r.ap)}`:'')+`<br>Falta: ${f0(Math.max(goal-r.t,0))}`;
      else h=`<b>${mLabel(r.m)}</b> · projeção<br>Total: ${f0(r.t)}<br>Se juros caírem: ${f0(r.low)}<br>${r.t>=goal?'✅ meta atingida':'Falta: '+f0(goal-r.t)}`;
      tip.innerHTML=h;const bb=box.getBoundingClientRect();tip.style.left=Math.max(0,Math.min(e.clientX-bb.left+14,bb.width-240))+'px';tip.style.top=(e.clientY-bb.top+14)+'px';tip.style.opacity=1;};
    el.onclick=el.onmousemove;el.onmouseleave=()=>tip.style.opacity=0;});
  const used=TYPE_ORDER.filter(id=>real.some(r=>byType(r.bal).some(([t])=>t===id)));
  $('lgTower').innerHTML=used.map(id=>`<span><i style="background:${typeColor(id)}"></i>${esc(TYPE_NAME[id])}</span>`).join('')+
    `<span><i class="lg-proj"></i>Projeção (${String(S.rate).replace('.',',')}% a.a.)</span><span><i class="lg-line lg-low"></i>Se juros caírem (${String(lowerRate()).replace('.',',')}% a.a.)</span><span><i class="lg-line lg-goal"></i>Meta</span>`;
}

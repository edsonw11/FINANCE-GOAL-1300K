/**
 * ui/charts/projection-chart.js
 * Responsibility: Month-by-month projection chart (scenarios).
 */
import { $, css } from '../../core/dom.js';
import { f0 } from '../../core/format.js';
import { mIdx, mKey, mLabel, mShort } from '../../core/dates.js';
import { S } from '../../domain/store.js';
import { chartWidth } from './chart-utils.js';
export function drawProj(real,baseA,consA,rc){
  const goal=S.goal,R=real.length,N=baseA.length,T=R+N;
  const W=chartWidth($('chProj'),980,240),narrow=W<640,H=narrow?300:380,L=narrow?52:70,Rr=narrow?12:22,Tp=26,B=44,pw=W-L-Rr,ph=H-Tp-B;
  const realV=real.map(r=>r.t),all=realV.concat(baseA,consA);
  const lo=Math.floor(Math.min(...all)*0.97/1e5)*1e5,hi=Math.max(goal*1.04,...all)*1.01,step=(hi-lo)>600000?2e5:1e5;
  const x=i=>L+(T===1?0:i*pw/(T-1)),y=v=>Tp+ph-(v-lo)/(hi-lo)*ph;
  const mlab=i=>i<R?real[i].m:mKey(mIdx(real[R-1].m)+(i-R+1));
  let s='';
  for(let g=Math.ceil(lo/step)*step;g<=hi;g+=step)s+=`<line x1="${L}" x2="${W-Rr}" y1="${y(g)}" y2="${y(g)}" stroke="${css('--line')}"/><text x="${L-8}" y="${y(g)+4}" text-anchor="end" font-size="12" fill="${css('--muted')}">${(g/1e6).toFixed(2).replace('.',',')} M</text>`;
  const every=Math.ceil(T/(narrow?Math.max(3,Math.floor(W/70)):12));
  for(let i=0;i<T;i+=every)s+=`<text x="${x(i)}" y="${H-B+20}" text-anchor="middle" font-size="12" fill="${css('--ink2')}">${mShort(mlab(i))}</text>`;
  // goal
  s+=`<line x1="${L}" x2="${W-Rr}" y1="${y(goal)}" y2="${y(goal)}" stroke="${css('--meta')}" stroke-width="2.5" stroke-dasharray="7 5"/><text x="${L+4}" y="${y(goal)-7}" font-size="13" font-weight="700" fill="${css('--meta')}">Meta ${f0(goal)}</text>`;
  const pts=(arr,off)=>arr.map((v,k)=>`${x(off+k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  // base scenario area
  s+=`<polygon points="${x(R-1)},${y(lo)} ${pts([realV[R-1]].concat(baseA),R-1)} ${x(T-1)},${y(lo)}" fill="${css('--brand')}" fill-opacity=".08"/>`;
  s+=`<polyline points="${pts([realV[R-1]].concat(consA),R-1)}" fill="none" stroke="${css('--warn')}" stroke-width="2.5" stroke-dasharray="3 5" stroke-linecap="round"/>`;
  s+=`<polyline points="${pts([realV[R-1]].concat(baseA),R-1)}" fill="none" stroke="${css('--brand')}" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round"/>`;
  if(R>1)s+=`<polyline points="${pts(realV,0)}" fill="none" stroke="${css('--brand')}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  // marker for the goal month (base scenario) and for today
  const hb=baseA.findIndex(v=>v>=goal);
  if(hb>=0){const i=R+hb;s+=`<circle cx="${x(i)}" cy="${y(baseA[hb])}" r="7" fill="${css('--rec')}" stroke="${css('--card')}" stroke-width="2.5"/><text x="${x(i)}" y="${y(baseA[hb])-14}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${css('--rec')}">✅ ${mShort(mlab(i))}</text>`;}
  const hc=consA.findIndex(v=>v>=goal);
  if(hc>=0){const i=R+hc;s+=`<circle cx="${x(i)}" cy="${y(consA[hc])}" r="6" fill="${css('--warn')}" stroke="${css('--card')}" stroke-width="2.5"/>`;}
  s+=`<circle cx="${x(R-1)}" cy="${y(realV[R-1])}" r="7" fill="${css('--brand')}" stroke="${css('--card')}" stroke-width="2.5"/><text x="${x(R-1)}" y="${y(realV[R-1])+24}" text-anchor="${narrow?'start':'middle'}" font-size="12.5" font-weight="700" fill="${css('--ink')}">Hoje${narrow?'':' '+f0(realV[R-1])}</text>`;
  s+=`<line id="xh" x1="0" x2="0" y1="${Tp}" y2="${Tp+ph}" stroke="${css('--muted')}" stroke-dasharray="3 3" display="none"/>`;
  const w=pw/Math.max(T-1,1);
  for(let i=0;i<T;i++)s+=`<rect class="hit2" data-i="${i}" x="${x(i)-w/2}" y="${Tp}" width="${w}" height="${ph}" fill="transparent"/>`;
  const sv=$('chProj');sv.setAttribute('viewBox',`0 0 ${W} ${H}`);sv.innerHTML=s;
  const tip=$('tip2'),box=$('box2'),xh=sv.querySelector('#xh');
  sv.querySelectorAll('.hit2').forEach(el=>{
    el.onmousemove=e=>{const i=+el.dataset.i;let h;
      if(i<R)h=`<b>${mLabel(mlab(i))}</b> · real<br>Saldo: ${f0(realV[i])}<br>Falta: ${f0(Math.max(goal-realV[i],0))}`;
      else{const k=i-R,b=baseA[k],c=consA[k];h=`<b>${mLabel(mlab(i))}</b> · projeção<br>Base: ${f0(b)}${b>=goal?' ✅':''}<br>Se juros caírem: ${f0(c)}${c>=goal?' ✅':''}<br>Falta (base): ${b>=goal?'meta atingida':f0(goal-b)}`;}
      tip.innerHTML=h;xh.setAttribute('x1',x(i));xh.setAttribute('x2',x(i));xh.removeAttribute('display');
      const bb=box.getBoundingClientRect();tip.style.left=Math.max(0,Math.min(e.clientX-bb.left+14,bb.width-230))+'px';tip.style.top=(e.clientY-bb.top+14)+'px';tip.style.opacity=1;};
    el.onclick=el.onmousemove;el.onmouseleave=()=>{tip.style.opacity=0;xh.setAttribute('display','none');};});
  $('lgProj').innerHTML=`<span><i class="lg-real"></i>Real</span><span><i class="lg-line lg-base"></i>Projeção base (${String(S.rate).replace('.',',')}% a.a.)</span><span><i class="lg-line lg-low"></i>Se juros caírem (${String(rc).replace('.',',')}% a.a.)</span><span><i class="lg-line lg-goal"></i>Meta</span>`;
}

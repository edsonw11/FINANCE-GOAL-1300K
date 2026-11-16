/**
 * ui/charts/donut-chart.js
 * Responsibility: a ring (donut) chart as SVG markup, with a leader line from each slice to its label
 * ("Renda fixa  30%") placed on the left or right side of the ring. Labels on one side are spread
 * vertically so they never overlap. Each slice is a circle stroke, so the slices always fill the ring exactly.
 * Pure: values in, markup out. donutSvg(slices:[{value, color, name, text, key, dim}], opts) -> string
 *   opts: {compact, centerTop, centerBottom, ariaLabel}
 */
import { esc } from '../../core/dom.js';
const GAP=1.5;       // visual space between slices, in ring units (only when there is more than one)
const LINE_H=13;     // height of one line of label text
const MARGIN=16;     // space kept above and below the labels
// compact (phones): drawn at the real width, so the text keeps its size; the ring takes what the labels leave
// wide: drawn at a fixed design width and scaled
function layout(o,maxLines,perSide){
  const compact=!!o.compact,w=compact?(o.width||340):620,zone=compact?66:150,ro=Math.min(compact?96:130,w/2-zone-16),t=Math.round(ro*0.4);
  const step=(maxLines+1)*LINE_H+8,h=Math.max(2*ro+2*MARGIN+24,perSide*step+2*MARGIN);
  return {w,h,ro,t,step,chars:Math.floor(zone/(compact?6.1:7)),cx:w/2,cy:h/2};
}
// a name on at most two lines of `chars` characters (the second ends with … when it does not fit)
export function wrapName(name,chars){
  const words=String(name).split(' '),lines=[''];
  words.forEach(w=>{const cur=lines[lines.length-1];
    if(!cur)lines[lines.length-1]=w;else if((cur+' '+w).length<=chars)lines[lines.length-1]=cur+' '+w;else lines.push(w);});
  const cut=l=>l.length>chars?l.slice(0,chars-1)+'…':l;
  if(lines.length>2){const rest=lines.slice(1).join(' ');lines.length=1;lines.push(rest);}
  return lines.map(cut);
}
// labels of one side: sorted by wanted y, then pushed apart (down, then back up if they hit the bottom)
export function spreadLabels(ys,min,top,bottom){
  const order=ys.map((y,i)=>i).sort((a,b)=>ys[a]-ys[b]),out=ys.slice();
  let prev=top-min;order.forEach(i=>{out[i]=Math.max(ys[i],prev+min);prev=out[i];});
  let next=bottom+min;for(let k=order.length-1;k>=0;k--){const i=order[k];out[i]=Math.min(out[i],next-min);next=out[i];}
  return out;
}
export function donutSvg(slices,o){
  o=o||{};
  const total=slices.reduce((x,y)=>x+y.value,0),probe=layout(o,1,1),named=slices.map(x=>({x,lines:wrapName(x.name,probe.chars)}));
  const maxLines=Math.max(1,...named.map(n=>n.lines.length));
  // first pass only to know how many labels end up on each side
  const sideOf=[];{let off=0;named.forEach(n=>{const f=total?n.x.value/total:0,mid=(off+f/2);sideOf.push(Math.sin(2*Math.PI*mid)>=0?1:-1);off+=f;});}
  const perSide=Math.max(1,sideOf.filter(v=>v>0).length,sideOf.filter(v=>v<0).length);
  const z=layout(o,maxLines,perSide),cx=z.cx,cy=z.cy,r=z.ro-z.t/2,C=2*Math.PI*r;
  let off=0;const arcs=[],marks=[];
  named.forEach(({x,lines})=>{
    const len=total>0?C*x.value/total:0,gap=slices.length>1?Math.min(GAP,len*0.5):0,ang=2*Math.PI*(off+len/2)/C-Math.PI/2,k=x.key!==undefined?` data-key="${esc(x.key)}"`:'';
    arcs.push(`<circle${k} cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${x.color}"${x.dim?' opacity="0.3"':''} stroke-width="${z.t}" stroke-dasharray="${(len-gap).toFixed(2)} ${(C-len+gap).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(x.name)}: ${esc(x.text)}</title></circle>`);
    marks.push({x,lines,ang,side:Math.cos(ang)>=0?1:-1});off+=len;
  });
  marks.forEach(m=>{m.wantY=cy+(z.ro+14)*Math.sin(m.ang);});
  [-1,1].forEach(side=>{
    const own=marks.filter(m=>m.side===side),ys=spreadLabels(own.map(m=>m.wantY),z.step,MARGIN+z.step/2,z.h-MARGIN-z.step/2);own.forEach((m,i)=>{m.ly=ys[i];});
  });
  const colX=side=>cx+side*(z.ro+22);
  const callouts=marks.filter(()=>total>0).map(m=>{
    const {x,lines,ang,side}=m,ax=cx+(z.ro+1)*Math.cos(ang),ay=cy+(z.ro+1)*Math.sin(ang),ex=cx+(z.ro+10)*Math.cos(ang),ey=cy+(z.ro+10)*Math.sin(ang),lx=colX(side),tx=lx+side*4;
    const k=x.key!==undefined?` data-key="${esc(x.key)}"`:'',anchor=side>0?'start':'end',block=(lines.length+1)*LINE_H,y0=m.ly-block/2+LINE_H-3;
    return `<g class="donut-call"${k}${x.dim?' opacity="0.35"':''}><polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${lx.toFixed(1)},${m.ly.toFixed(1)}" fill="none" stroke="${x.color}" stroke-width="1.4"/>`+
      lines.map((l,i)=>`<text x="${tx.toFixed(1)}" y="${(y0+i*LINE_H).toFixed(1)}" text-anchor="${anchor}" class="donut-name">${esc(l)}</text>`).join('')+
      `<text x="${tx.toFixed(1)}" y="${(y0+lines.length*LINE_H).toFixed(1)}" text-anchor="${anchor}" class="donut-pct" fill="${x.color}">${esc(x.text)}</text></g>`;}).join('');
  return `<svg viewBox="0 0 ${z.w} ${z.h}" class="donut" role="img" aria-label="${esc(o.ariaLabel||'Distribuição')}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--soft)" stroke-width="${z.t}"/>${arcs.join('')}${callouts}`+
    (o.centerTop?`<text x="${cx}" y="${cy-1}" text-anchor="middle" class="donut-top${o.compact?' sm':''}">${o.centerTop}</text>`:'')+
    (o.centerBottom?`<text x="${cx}" y="${cy+15}" text-anchor="middle" class="donut-bottom">${o.centerBottom}</text>`:'')+`</svg>`;
}

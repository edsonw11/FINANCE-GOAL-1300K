/**
 * ui/charts/chart-utils.js
 * Responsibility: SVG chart helpers: rounded rectangle and smooth curve.
 */
function rr(x,y,w,h,r){if(!r||h<2*r)return `M${x},${y}h${w}v${h}h${-w}z`;return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}z`;}
function smoothPath(pts){ // Catmull-Rom -> Bézier
  if(pts.length<2)return '';let d=`M${pts[0][0]},${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2,t=0.18;
    d+=` C${p1[0]+(p2[0]-p0[0])*t},${p1[1]+(p2[1]-p0[1])*t} ${p2[0]-(p3[0]-p1[0])*t},${p2[1]-(p3[1]-p1[1])*t} ${p2[0]},${p2[1]}`;}
  return d;}

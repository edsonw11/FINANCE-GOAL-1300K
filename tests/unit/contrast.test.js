/**
 * Readability: every text color of the design (light and dark theme) must have a contrast of at least
 * 4.5:1 (WCAG AA for small text) on the surfaces it is used on. Reads the real tokens file.
 */
const fs=require('fs'),path=require('path');
const {suite}=require('./harness');
module.exports=()=>{const {eq,res}=suite('contrast');
  const css=fs.readFileSync(path.join(__dirname,'../../src/styles/01-tokens.css'),'utf8');
  const dark=css.indexOf('prefers-color-scheme: dark'),blocks={light:css.slice(0,dark),dark:css.slice(dark)};
  const tok=(b,n)=>{const m=b.match(new RegExp('--'+n+':\\s*(#[0-9a-fA-F]{6})'));return m&&m[1];};
  const lum=h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4));return .2126*r+.7152*g+.0722*b;};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  const TEXT=['ink','ink2','muted','rec','des','apo','brand','warn-ink','meta'],SURFACES=['card','bg','soft'];
  ['light','dark'].forEach(theme=>{
    const own=blocks[theme],base=blocks.light,get=n=>tok(own,n)||tok(base,n);
    const fails=[];
    TEXT.forEach(t=>SURFACES.forEach(sf=>{const a=get(t),b=get(sf);if(!a||!b){fails.push(t+'/'+sf+': missing');return;}const r=ratio(a,b);if(r<4.5)fails.push(`${t} on ${sf}: ${r.toFixed(2)}`);}));
    eq(theme+' theme: all text colors reach 4.5:1 on card, background and soft surfaces',fails,[]);
  });
  return res;};

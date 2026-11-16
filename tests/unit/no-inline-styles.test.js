/**
 * Styling rules (presentation lives in src/styles, not in markup):
 * 1. index.html has no style="..." attribute.
 * 2. UI modules only write style="..." for values computed at runtime, so every inline style
 *    must contain a ${...} interpolation (widths in %, account colors). Fixed looks use classes.
 * 3. CSS never selects on inline styles ([style*=...]), which breaks as soon as markup changes.
 * 4. Visibility is toggled with the hidden attribute, not with style.display.
 */
const fs=require('fs'),path=require('path');
const {suite,root}=require('./harness');
const walk=(d,ext)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name),ext):e.name.endsWith(ext)?[path.join(d,e.name)]:[]);

module.exports=()=>{const {eq,res}=suite('no-inline-styles');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  eq('index.html has no inline style',[...html.matchAll(/\sstyle="[^"]*"/g)].map(m=>m[0]),[]);
  for(const f of walk(path.join(root,'src','ui'),'.js')){const rel=path.relative(root,f),code=fs.readFileSync(f,'utf8');
    eq(rel+': inline styles only carry runtime values',[...code.matchAll(/style="([^"]*)"/g)].map(m=>m[1]).filter(v=>!v.includes('${')),[]);
    eq(rel+': visibility uses hidden, not style.display',[...code.matchAll(/\.style\.display\s*=/g)].length,0);
  }
  for(const f of walk(path.join(root,'src','styles'),'.css'))
    eq(path.relative(root,f)+' does not select on inline styles',[...fs.readFileSync(f,'utf8').matchAll(/\[style[*^$~|]?=/g)].length,0);
  return res;};

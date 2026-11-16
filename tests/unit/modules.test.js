/**
 * Module rules (checked on the import graph of src/):
 * 1. Layers only point down: core imports only core; domain imports core and domain;
 *    ui imports core, domain and ui; nothing imports app.js.
 * 2. Every source file is reachable from src/app.js (no forgotten module).
 * 3. Every import resolves to a real export: core + domain modules are imported by Node itself
 *    (they need no browser), ui modules are checked against the names they export.
 * 4. Imports always use relative paths ending in .js (what the browser needs).
 * 5. The dist/ bundle (all modules in one script) compiles: two modules must not declare the same
 *    top-level name, since in one script that is a SyntaxError and the built file would not run.
 */
const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const {suite,root}=require('./harness');
const {importsOf,moduleOrder,bundle}=require('../../tools/module-graph.cjs');
const vm=require('vm');
const src=path.join(root,'src');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.js')?[path.join(d,e.name)]:[]);
const layer=f=>{const r=path.relative(src,f);return r==='app.js'?'app':r.split(path.sep)[0];};
const ALLOWED={core:['core'],domain:['core','domain'],ui:['core','domain','ui'],app:['core','domain','ui']};
// names a ui module exports (export function a / export const a=..., b=... on one line)
const exported=code=>new Set([...code.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class)\s+([\w$]+)/gm)].map(m=>m[1])
  .concat([...code.matchAll(/^export\s+(?:const|let|var)\s+(.*)$/gm)].flatMap(m=>{
    // top-level names of the declaration: identifiers followed by = at bracket depth 0
    const out=[];let depth=0,start=true,q=null;const s=m[1];
    for(let i=0;i<s.length;i++){const c=s[i];
      if(q){if(c==='\\')i++;else if(c===q)q=null;continue;}
      if(c==='"'||c==="'"||c==='`'){q=c;continue;}
      if('([{'.includes(c))depth++;else if(')]}'.includes(c))depth--;
      else if(depth===0&&c===',')start=true;
      else if(start&&depth===0){const n=s.slice(i).match(/^([\w$]+)\s*=/);if(n){out.push(n[1]);i+=n[0].length-1;}start=false;}}
    return out;})));

module.exports=async()=>{const {ok,eq,res}=suite('modules');
  const files=walk(src);
  for(const f of files){const rel=path.relative(root,f),code=fs.readFileSync(f,'utf8');
    for(const i of importsOf(f,code)){
      ok(`${rel} may import ${path.relative(root,i.from)}`,ALLOWED[layer(f)].includes(layer(i.from)));
      ok(`${rel} imports an existing file ${path.relative(root,i.from)}`,fs.existsSync(i.from));
    }
    const bad=[...code.matchAll(/^import\s.*from\s*'([^']+)'/gm)].map(m=>m[1]).filter(p=>!/^\.\.?\/.*\.js$/.test(p));
    eq(rel+' imports use relative .js paths',bad,[]);
    ok(rel+' has no import the bundler would miss (one import per line, named)',![...code.matchAll(/^import\b.*$/gm)].some(m=>!/^import\s*\{[^}]*\}\s*from\s*'[^']+';\s*$/.test(m[0])));
  }
  const reached=new Set(moduleOrder(path.join(src,'app.js')));
  eq('every module is reachable from app.js',files.filter(f=>!reached.has(f)).map(f=>path.relative(root,f)),[]);
  // ui modules: each imported name is exported by the target
  const cache={};const exp=f=>cache[f]||(cache[f]=exported(fs.readFileSync(f,'utf8')));
  for(const f of files.filter(f=>['ui','app'].includes(layer(f))))
    for(const i of importsOf(f))i.names.forEach(n=>ok(`${path.relative(root,f)}: ${n} is exported by ${path.relative(root,i.from)}`,exp(i.from).has(n)));
  let bundleErr=null;try{new vm.Script(bundle(path.join(src,'app.js'),root),{filename:'dist-bundle.js'});}catch(e){bundleErr=e.message;}
  eq('the dist bundle compiles (no top-level name declared in two modules)',bundleErr,null);
  // core + domain: real ES module loading in Node (fails on a missing export)
  for(const f of files.filter(f=>['core','domain'].includes(layer(f)))){
    let err=null;try{await import(pathToFileURL(f).href);}catch(e){err=e.message;}
    eq(path.relative(root,f)+' loads as an ES module in Node',err,null);
  }
  return res;};

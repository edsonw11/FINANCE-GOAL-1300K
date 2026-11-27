/**
 * Architecture rules (checked on the source code):
 * 1. core/ and domain/ never touch the DOM, toast, render or dialogs.
 * 2. ui/ never changes the state directly: no save(), no S=..., no S.x=..., no push/splice/delete on S.
 *    Screens call domain commands inside transact()/runCommand().
 * 3. Every source file starts with a header naming the file and stating its single responsibility.
 */
const fs=require('fs'),path=require('path');
const {suite,root}=require('./harness');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.js')?[path.join(d,e.name)]:[]);
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1').replace(/`(?:\\[\s\S]|[^`])*`/g,'``').replace(/'(?:\\.|[^'\\])*'/g,"''");
module.exports=()=>{const {ok,res}=suite('architecture');
  const src=path.join(root,'src');
  for(const f of walk(path.join(src,'core')).concat(walk(path.join(src,'domain')))){
    if(f.endsWith('dom.js'))continue;
    const c=strip(fs.readFileSync(f,'utf8'));
    ok(path.relative(root,f)+' has no DOM/UI calls',/locale-[\w-]+\.js$/.test(f)||!/\b(document|window\.|toast\(|render\(|askConfirm|confirm\(|alert\()/.test(c));
  }
  const bad=/(^|[^.\w])save\(\)|(^|[^.\w])S\s*=[^=]|(^|[^.\w])S\.[\w.[\]'"+]+\s*(=[^=]|\+\+|--|\+=|-=)|(^|[^.\w])S\.[\w.[\]'"+]+\.(push|splice|pop|shift|unshift|sort)\(|delete\s+S\./m;
  for(const f of walk(path.join(src,'ui')).concat([path.join(src,'app.js')])){
    const c=strip(fs.readFileSync(f,'utf8')),m=c.match(bad);
    ok(path.relative(root,f)+' does not change the state directly'+(m?' (found: '+m[0].trim()+')':''),!m);
  }
  for(const f of walk(src)){const c=fs.readFileSync(f,'utf8'),rel=path.relative(src,f);
    ok(path.relative(root,f)+' has a responsibility header',/^\/\*\*[\s\S]*?Responsibility:/.test(c));
    ok(path.relative(root,f)+' header names the file',c.startsWith('/**\n * '+rel+'\n'));}
  return res;};

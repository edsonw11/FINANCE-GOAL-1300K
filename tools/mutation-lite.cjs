#!/usr/bin/env node
/**
 * tools/mutation-lite.cjs
 * Responsibility: a small mutation test for the browser unit suite. It works on a COPY of the repository (the working tree is never touched): for each target
 * file it applies one small change at a time (a flipped comparison, && <-> ||, + <-> -, a constant moved by one, true <-> false), runs tests/run-unit.js, and
 * reports which changes the tests noticed ("killed") and which they did not ("survived"). A survivor is either a missing test or an equivalent change: read it.
 * Usage: node tools/mutation-lite.cjs [--per-file 8] [--seed 1] [--out report.json] file.js [file.js ...]
 * With --lines 12,40 every mutant on those line numbers is run (no sampling): use it to re-check known survivors.
 * Mutants that do not parse are skipped. Selection is seeded, so the same command gives the same mutants.
 */
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);const opt=(n,d)=>{const i=args.indexOf(n);return i<0?d:args.splice(i,2)[1];};
const only=opt('--lines',null),onlyLines=only?new Set(only.split(',').map(Number)):null;
const perFile=onlyLines?Infinity:+opt('--per-file',8),seed=+opt('--seed',1),out=opt('--out',null),files=args;
if(!files.length){console.error('usage: mutation-lite.cjs [--per-file N] [--seed N] [--out file] src/...js');process.exit(2);}
let st=seed>>>0||1;const rnd=()=>{st^=st<<13;st>>>=0;st^=st>>>17;st^=st<<5;st>>>=0;return st/4294967296;};
const OPS=[
  [/===/g,'!=='],[/!==/g,'==='],[/<=/g,'<'],[/>=/g,'>'],[/(?<![<=-])<(?![=<])/g,'<='],[/(?<![=>-])>(?![=>])/g,'>='],
  [/&&/g,'||'],[/\|\|/g,'&&'],[/(?<=[\w)\]])\+(?=[\w(])/g,'-'],[/(?<=[\w)\]])-(?=[\w(])/g,'+'],[/(?<=[\w)\]])\*(?=[\w(])/g,'/'],
  [/\btrue\b/g,'false'],[/\bfalse\b/g,'true'],[/(?<![\w.'"/-])(\d+)(?![\w.'"/])/g,(m)=>String(+m+1)],
];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mutlite-'));
for(const d of ['src','tests','tools','vendor','scripts','dist','docs/architecture/baseline','index.html'])fs.cpSync(path.join(root,d),path.join(tmp,d),{recursive:true});
fs.copyFileSync(path.join(root,'package.json'),path.join(tmp,'package.json'));
const parses=(text)=>spawnSync(process.execPath,['--input-type=module','--check'],{input:text}).status===0;
const runSuite=()=>{const r=spawnSync(process.execPath,['tests/run-unit.js'],{cwd:tmp,encoding:'utf8',timeout:40000});return r;};
const base=runSuite();if(base.status!==0){console.error('the suite does not pass without mutations: fix that first');process.exit(2);}
const report=[];let killed=0,survived=0,skipped=0;
for(const rel of files){
  const abs=path.join(tmp,rel),orig=fs.readFileSync(abs,'utf8'),lines=orig.split('\n'),cands=[];
  lines.forEach((line,i)=>{
    const t=line.trim();if(!t||t.startsWith('//')||t.startsWith('*')||t.startsWith('/*')||t.startsWith('import ')||/^export \{/.test(t))return;
    const code=line.replace(/\/\/.*$/,'');
    OPS.forEach(([re,rep],oi)=>{let m;re.lastIndex=0;const rx=new RegExp(re.source,re.flags);while((m=rx.exec(code))){
      // not inside a string or a regex literal: cheap test, count quotes before the match
      const before=code.slice(0,m.index);if(((before.match(/'/g)||[]).length%2)||((before.match(/"/g)||[]).length%2)||((before.match(/`/g)||[]).length%2))continue;
      if(/\/[^/\s][^/]*$/.test(before)&&/^[^/]*\/[^/]+\/[gimsuy]*[.,;)\s]/.test(code.slice(Math.max(0,before.lastIndexOf('/')))))continue;
      cands.push({i,at:m.index,len:m[0].length,rep:typeof rep==='function'?rep(m[0]):rep,op:m[0]+' -> '+(typeof rep==='function'?rep(m[0]):rep)});}});});
  if(onlyLines)for(let k=cands.length-1;k>=0;k--)if(!onlyLines.has(cands[k].i+1))cands.splice(k,1);
  if(!onlyLines)for(let k=cands.length-1;k>0;k--){const j=Math.floor(rnd()*(k+1));[cands[k],cands[j]]=[cands[j],cands[k]];}
  let done=0;
  for(const c of cands){
    if(done>=perFile)break;
    const ls=lines.slice();const L=ls[c.i];ls[c.i]=L.slice(0,c.at)+c.rep+L.slice(c.at+c.len);const mutated=ls.join('\n');
    if(mutated===orig||!parses(mutated)){skipped++;continue;}
    fs.writeFileSync(abs,mutated);const r=runSuite();fs.writeFileSync(abs,orig);done++;
    const dead=r.status!==0;dead?killed++:survived++;
    report.push({file:rel,line:c.i+1,col:c.at+1,change:c.op,source:lines[c.i].trim().slice(0,110),result:dead?'killed':'SURVIVED'});
    process.stderr.write(`${dead?'killed  ':'SURVIVED'} ${rel}:${c.i+1}:${c.at+1} ${c.op}\n`);
  }
}
const total=killed+survived,summary={mutants:total,killed,survived,skippedNotParsing:skipped,score:total?Math.round(1000*killed/total)/10:null};
if(out)fs.writeFileSync(out,JSON.stringify({summary,report},null,1));
console.log(JSON.stringify(summary));
fs.rmSync(tmp,{recursive:true,force:true});

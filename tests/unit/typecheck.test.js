/**
 * tests/unit/typecheck.test.js
 * Responsibility: the TypeScript check that CI runs (npm run typecheck) also runs with the unit suite, so a type error
 * is found before the push and not on GitHub.
 */
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
module.exports=async()=>{
  const root=path.join(__dirname,'..','..');
  const tsc=path.join(root,'node_modules','.bin','tsc');
  if(!fs.existsSync(tsc))return {name:'typecheck',pass:0,fail:1,msgs:['  ✗ typescript is not installed here: run npm ci (CI runs the same check)']};
  const r=spawnSync(tsc,['-p','tsconfig.json'],{cwd:root,encoding:'utf8'});
  const out=((r.stdout||'')+(r.stderr||'')).trim();
  return r.status===0
    ?{name:'typecheck',pass:1,fail:0,msgs:[]}
    :{name:'typecheck',pass:0,fail:1,msgs:['  ✗ tsc found type errors:',...out.split('\n').slice(0,15).map(l=>'    '+l)]};
};

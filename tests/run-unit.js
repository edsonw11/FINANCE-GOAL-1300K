/**
 * tests/run-unit.js
 * Responsibility: runs every tests/unit/*.test.js and prints a summary. Exit code 1 on failure.
 * A test file exports a function returning (or resolving to) {name,pass,fail,msgs}.
 * Usage: node tests/run-unit.js [--seed N] [--only name,name]
 *   --seed N    runs the files in a shuffled order (the same N gives the same order): a file that depends on another one having run first fails
 *   --only a,b  runs only the files named a.test.js and b.test.js (each file must pass alone)
 */
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'unit');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
const seed=arg('--seed'),only=arg('--only');
(async()=>{
let pass=0,fail=0;
let files=fs.readdirSync(dir).filter(f=>f.endsWith('.test.js')).sort();
if(only)files=files.filter(f=>only.split(',').includes(f.replace('.test.js','')));
if(seed!==null){let st=(+seed>>>0)||1;const rnd=()=>{st^=st<<13;st>>>=0;st^=st>>>17;st^=st<<5;st>>>=0;return st/4294967296;};
  for(let i=files.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[files[i],files[j]]=[files[j],files[i]];}console.log('order seed '+seed);}
for(const f of files){
  let r;
  try{r=await require(path.join(dir,f))();}catch(e){r={name:f,pass:0,fail:1,msgs:['  ✗ crashed: '+e.message]};}
  pass+=r.pass;fail+=r.fail;
  console.log(`${r.fail?'✗':'✓'} ${f.replace('.test.js','')}: ${r.pass} passed${r.fail?', '+r.fail+' failed':''}`);
  r.msgs.forEach(m=>console.log(m));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
})();

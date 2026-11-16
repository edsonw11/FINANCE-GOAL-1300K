/**
 * tests/run-unit.js
 * Responsibility: runs every tests/unit/*.test.js and prints a summary. Exit code 1 on failure.
 * A test file exports a function returning (or resolving to) {name,pass,fail,msgs}.
 * Usage: node tests/run-unit.js
 */
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'unit');
(async()=>{
let pass=0,fail=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.test.js')).sort()){
  let r;
  try{r=await require(path.join(dir,f))();}catch(e){r={name:f,pass:0,fail:1,msgs:['  ✗ crashed: '+e.message]};}
  pass+=r.pass;fail+=r.fail;
  console.log(`${r.fail?'✗':'✓'} ${f.replace('.test.js','')}: ${r.pass} passed${r.fail?', '+r.fail+' failed':''}`);
  r.msgs.forEach(m=>console.log(m));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
})();

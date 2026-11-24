/**
 * Characterization of the financial rules: the results of the main rules on one invented state (frozen clock) must
 * equal docs/architecture/baseline/golden-calculations.json. A difference means a rule changed: if it is on
 * purpose, regenerate the file (node tools/golden-calculations.cjs > docs/architecture/baseline/golden-calculations.json)
 * and say so in the review; if not, it is a regression.
 */
const fs=require('fs'),path=require('path');
const {suite,root}=require('./harness');
const {golden}=require('../../tools/golden-calculations.cjs');
module.exports=()=>{const {eq,ok,res}=suite('golden');
  const file=path.join(root,'docs','architecture','baseline','golden-calculations.json');
  ok('the baseline file exists',fs.existsSync(file));
  const expected=JSON.parse(fs.readFileSync(file,'utf8')),got=JSON.parse(JSON.stringify(golden()));
  Object.keys(expected).forEach(k=>eq('rule group "'+k+'" is unchanged',got[k],expected[k]));
  eq('no rule group was added or removed without regenerating the file',Object.keys(got),Object.keys(expected));
  eq('the clock is frozen: the same result twice',JSON.parse(JSON.stringify(golden())),got);
  return res;};

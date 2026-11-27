/**
 * Rules for every combo of the app (a field with a list, or a select), so the bugs found by the owner do not come back:
 * - a field with a phone list (input list=...) was small and filtered by what was typed, so it could not be read or changed: each one must
 *   also have its one-tap choices (chips) in the same wrapper;
 * - the tap on a chip is handled in ONE place, installed at start;
 * - the group of a category is a select, not a text field with a list.
 * The size of every combo on screen (wide enough, tall enough, value not cut) is checked at phone widths by tests/mobile-check.js.
 */
const fs=require('fs'),path=require('path');
const {suite}=require('./harness');
const root=path.join(__dirname,'..','..');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
module.exports=()=>{const {eq,ok,res}=suite('combo-rules');
  const files=walk(path.join(root,'src')).filter(f=>f.endsWith('.js')).concat([path.join(root,'index.html')]);
  const rel=f=>path.relative(root,f);
  const withList=files.filter(f=>/<input[^>]*\blist="/.test(fs.readFileSync(f,'utf8')));
  ok('there are fields with a list to protect (the rule is not vacuous)',withList.length>=4);
  withList.forEach(f=>{const s=fs.readFileSync(f,'utf8'),lists=(s.match(/<input[^>]*\blist="/g)||[]).length,chips=(s.match(/chipsBox\(|data-qchips|chipsHtml\(/g)||[]).length;
    ok(rel(f)+': every field with a list has chips ('+lists+' fields, '+chips+' chips)',chips>=lists);});
  const component=fs.readFileSync(path.join(root,'src/ui/components/category-chips.js'),'utf8');
  eq('the tap on a chip is one document handler, not one per screen',(component.match(/document\.addEventListener\('click'/g)||[]).length,1);
  ok('the handler fires input and change, so each screen reacts as if the name had been typed',/\['input','change'\]/.test(component));
  ok('the handler is installed at start',/installCategoryChips\(\);/.test(fs.readFileSync(path.join(root,'src/app.js'),'utf8')));
  const others=files.filter(f=>!f.endsWith('category-chips.js')&&!f.endsWith('index.html'));
  eq('no other file sets a chip handler of its own',others.filter(f=>/\[data-qc\]|dataset\.qc\b/.test(fs.readFileSync(f,'utf8'))).map(rel),[]);
  const categories=fs.readFileSync(path.join(root,'src/ui/views/categories.js'),'utf8');
  ok('the group of a category is chosen in a select (readable on a phone)',/<select class="ci" data-cg=/.test(categories)&&!/list="groupList"/.test(categories));
  ok('a new group can still be created from the select',/Novo grupo/.test(categories)&&/NEW_GROUP/.test(categories));
  return res;};

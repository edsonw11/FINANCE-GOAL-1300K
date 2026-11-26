/**
 * tests/unit/harness.js
 * Responsibility: loads the core + domain modules into an isolated context (no browser) with an
 * in-memory storage, and offers tiny assertion helpers. Each *.test.js gets a fresh context.
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {moduleOrder,stripModule}=require('../../tools/module-graph.cjs');
const root=path.join(__dirname,'..','..');
// core + domain modules in evaluation order (dependencies first)
function domainFiles(){
  const dir=d=>fs.readdirSync(path.join(root,'src',d)).filter(f=>f.endsWith('.js')).sort().map(f=>path.join(root,'src',d,f));
  return moduleOrder(dir('core').concat(dir('domain')));
}
/** A Date whose "now" is always noon of the given ISO day (a test that needs a fixed today passes {today}); with arguments it is the normal Date. */
function fixedDate(iso){
  const [y,m,d]=iso.split('-').map(Number),now=new Date(y,m-1,d,12).getTime();
  function FixedDate(...a){return a.length?new Date(...a):new Date(now);}
  FixedDate.prototype=Date.prototype;FixedDate.now=()=>now;FixedDate.UTC=Date.UTC;FixedDate.parse=Date.parse;
  return FixedDate;
}
function createContext(opts={}){
  const mem={},storage={
    getItem:k=>mem[k]??null,
    setItem:(k,v)=>{if(storage.fail)throw new Error('QuotaExceededError');mem[k]=String(v);},mem};
  const ctx={console,Math,JSON,Date:opts.today?fixedDate(opts.today):Date,Intl,String,Number,Object,Array,Set,Map,Error,parseInt,parseFloat,isNaN,localStorage:storage};
  vm.createContext(ctx);
  // the modules become one script (imports removed), so a test can call any top-level function
  domainFiles().forEach(f=>vm.runInContext(stripModule(fs.readFileSync(f,'utf8')),ctx,{filename:path.relative(root,f)}));
  const run=code=>vm.runInContext(code,ctx);
  return {ctx,run,storage};
}
function suite(name){
  const res={name,pass:0,fail:0,msgs:[]};
  const eq=(label,got,exp)=>{const a=JSON.stringify(got),b=JSON.stringify(exp);
    if(a===b)res.pass++;else{res.fail++;res.msgs.push(`  ✗ ${label}\n      got:      ${a}\n      expected: ${b}`);}};
  const ok=(label,cond)=>eq(label,!!cond,true);
  const near=(label,got,exp,tol=0.005)=>Math.abs(got-exp)<=tol?res.pass++:(res.fail++,res.msgs.push(`  ✗ ${label}: ${got} vs ${exp}`));
  return {eq,ok,near,res};
}
module.exports={createContext,suite,root,domainFiles};

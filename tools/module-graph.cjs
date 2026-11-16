/**
 * tools/module-graph.cjs
 * Responsibility: reads the ES module graph of src/ (imports and exports, one import per line)
 * and turns it into a single classic script, so dist/ also works when opened from file://.
 * Used by scripts/build.py (bundle) and by the unit tests (load order, graph checks).
 *
 * CLI:
 *   node tools/module-graph.cjs bundle src/app.js   prints the bundled script
 *   node tools/module-graph.cjs order  src/app.js   prints the files in evaluation order
 */
const fs=require('fs'),path=require('path');

const IMPORT_RE=/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';[ \t]*$/gm;

// imports of one file: [{names:[...], from:'abs path'}]
function importsOf(file,code=fs.readFileSync(file,'utf8')){
  return [...code.matchAll(IMPORT_RE)].map(m=>({
    names:m[1].split(',').map(s=>s.trim()).filter(Boolean),
    from:path.resolve(path.dirname(file),m[2])}));
}
// files reachable from the entries, dependencies first (same order the browser evaluates them)
function moduleOrder(entries){
  const order=[],seen=new Set();
  const visit=f=>{if(seen.has(f))return;seen.add(f);importsOf(f).forEach(i=>visit(i.from));order.push(f);};
  [].concat(entries).forEach(e=>visit(path.resolve(e)));
  return order;
}
// one module as a classic script fragment (imports removed, "export " dropped)
function stripModule(code){return code.replace(IMPORT_RE,'').replace(/^export\s+/gm,'');}
function bundle(entries,root=process.cwd()){
  return moduleOrder(entries).map(f=>'// ---- '+path.relative(root,f)+'\n'+stripModule(fs.readFileSync(f,'utf8'))).join('\n');
}

module.exports={importsOf,moduleOrder,stripModule,bundle};

if(require.main===module){
  const [cmd,entry]=process.argv.slice(2);
  if(cmd==='bundle')process.stdout.write('"use strict";\n(()=>{\n'+bundle(entry)+'\n})();\n');
  else if(cmd==='order')console.log(moduleOrder(entry).map(f=>path.relative(process.cwd(),f)).join('\n'));
  else{console.error('usage: node tools/module-graph.cjs bundle|order <entry>');process.exit(2);}
}

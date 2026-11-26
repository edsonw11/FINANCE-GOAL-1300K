/**
 * Statement fixtures: every file in tests/fixtures/statements is read through the real importer and compared with the expectation written beside it
 * (<name>.expected.json). To add a new bank layout, drop the anonymised file and its expectation there: no code change is needed.
 *   *.csv, *.ofx          -> readImportFile; expectation {opts, ok, error?, drafts:[[date, value, type], ...]}
 *   *.pdf.txt             -> the text lines pdf.js would give for a digital PDF -> pdfEntries; expectation {opts, entries:[[date, amount], ...]}
 * The expected values are written by hand from the file, never copied from the program's output.
 */
const fs=require('fs'),path=require('path');
const {createContext,suite,root}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-fixtures');
  const dir=path.join(root,'tests','fixtures','statements'),J=JSON.stringify;
  const files=fs.readdirSync(dir).filter(f=>/\.(csv|ofx|pdf\.txt)$/.test(f)).sort();
  ok('there are fixtures to run',files.length>=7);
  run("S=seed();S.tx=[];S.imports=[];initCats();");
  for(const f of files){
    const base=f.replace(/\.(csv|ofx|pdf\.txt)$/,''),text=fs.readFileSync(path.join(dir,f),'utf8'),exp=JSON.parse(fs.readFileSync(path.join(dir,base+'.expected.json'),'utf8'));
    if(f.endsWith('.pdf.txt')){
      const r=run(`pdfEntries(${J(text)},${J(exp.opts||{})})`);
      eq(`${f}: entries (date, signed amount)`,r.entries.map(e=>[e.date,e.amount]),exp.entries);
    }else{
      const r=run(`readImportFile({name:${J(f)},text:${J(text)}},${J(exp.opts||{})})`);
      eq(`${f}: accepted or refused`,r.ok,exp.ok);
      if(exp.error)eq(`${f}: the reason given`,r.error,exp.error);
      if(!exp.ok)ok(`${f}: a refusal says why`,typeof r.error==='string'&&r.error.length>0);
      if(exp.drafts)eq(`${f}: drafts (date, value, type)`,r.drafts.map(d=>[d.date,d.value,d.type]),exp.drafts);
    }
  }
  return res;};

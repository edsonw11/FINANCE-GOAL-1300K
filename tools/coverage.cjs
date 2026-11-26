#!/usr/bin/env node
/**
 * tools/coverage.cjs
 * Responsibility: line, branch and function coverage of the browser unit suite for src/core, src/domain and src/sync, plus the files the suite never loads.
 * Uses V8's own coverage (NODE_V8_COVERAGE) and the c8 reporter. c8 is NOT a dependency of the project: it is fetched into a temporary folder for the run.
 * Usage: node tools/coverage.cjs [--reporter text|html|json-summary ...]   (output: coverage/ is written next to a text table on the terminal)
 * Limits: this measures the unit suite only. src/ui/views is exercised by the end to end suites (headless Chrome), which are not measured here.
 */
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cov-')),cov=path.join(tmp,'v8');fs.mkdirSync(cov);
const tool=path.join(tmp,'tool');fs.mkdirSync(tool);
const npm=(args)=>spawnSync('npm',args,{cwd:tool,encoding:'utf8'});
fs.writeFileSync(path.join(tool,'package.json'),'{"name":"c8tool","private":true}');
const C8_VERSION='12.0.0'; // pinned: the report must not change when a new c8 is published (needs Node ^20.19, ^22.12 or >=23)
const inst=npm(['install','c8@'+C8_VERSION,'--no-audit','--no-fund','--cache',path.join(tmp,'npm-cache')]);
if(inst.status!==0){console.error('could not fetch c8:\n'+inst.stderr);process.exit(2);}
const run=spawnSync(process.execPath,['tests/run-unit.js'],{cwd:root,encoding:'utf8',env:{...process.env,NODE_V8_COVERAGE:cov,NODE_OPTIONS:`--require ${path.join(root,'tools','coverage-preload.cjs')}`}});
process.stdout.write(run.stdout.split('\n').slice(-3).join('\n'));
if(run.status!==0){console.error('the unit suite failed: no coverage report');process.exit(1);}
// vm scripts are reported with a relative file name: give them a file:// url so that the reporter reads them from disk
for(const f of fs.readdirSync(cov)){const p=path.join(cov,f),d=JSON.parse(fs.readFileSync(p,'utf8'));
  d.result.forEach(s=>{if(/^src\//.test(s.url))s.url='file://'+path.join(root,s.url);});fs.writeFileSync(p,JSON.stringify(d));}
const reporters=process.argv.slice(2).length?process.argv.slice(2):['--reporter=text','--reporter=json-summary'];
const rep=spawnSync(path.join(tool,'node_modules','.bin','c8'),['report','--temp-directory',cov,'--clean=false','--all','--src',path.join(root,'src'),'--include','src/core/**','--include','src/domain/**','--include','src/sync/**','--include','src/ui/*.js','--include','src/ui/views/**','--report-dir',path.join(root,'coverage'),...reporters],{cwd:root,stdio:'inherit'});
fs.rmSync(tmp,{recursive:true,force:true});
process.exit(rep.status||0);

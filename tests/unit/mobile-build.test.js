/**
 * The Android web build (scripts/build-mobile.py): its Content-Security-Policy stays strict, and pdf.js travels as same-origin files, not as a blob
 * (a blob needs blob: in script-src, and without it the PDF reader failed with "Não consegui carregar o leitor de PDF" on the phone).
 */
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const {suite,root}=require('./harness');
module.exports=()=>{const {eq,ok,res}=suite('mobile-build');
  const run=spawnSync('python3',['-I',path.join(root,'scripts','build-mobile.py')],{encoding:'utf8'});
  eq('the build script runs',run.status,0);
  const www=path.join(root,'mobile','www'),page=fs.readFileSync(path.join(www,'index.html'),'utf8');
  const csp=(page.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)||['',''])[1];
  const dir=name=>(csp.split('; ').find(d=>d.startsWith(name+' '))||'').split(' ').slice(1);
  ok('the page carries a policy',csp.length>0);
  ok('scripts: only the page itself and hashed inline code',dir('script-src')[0]==="'self'"&&dir('script-src').slice(1).every(v=>/^'sha256-[A-Za-z0-9+/=]+'$/.test(v)));
  ok('scripts: no blob:, data:, unsafe-inline or unsafe-eval',!/blob:|data:|unsafe-/.test(dir('script-src').join(' ')));
  eq('workers: same origin only',dir('worker-src'),["'self'"]);
  eq('no network at all',dir('connect-src'),["'none'"]);
  ok('pdf.js is not embedded in the page',!/id="pdfjs(Lib|Worker)"/.test(page));
  for(const f of ['pdf.min.mjs','pdf.worker.min.mjs']){
    const copy=path.join(www,'vendor','pdfjs',f);
    ok(`vendor/pdfjs/${f} sits next to the page`,fs.existsSync(copy));
    ok(`vendor/pdfjs/${f} is the vendored file`,fs.existsSync(copy)&&fs.readFileSync(copy).equals(fs.readFileSync(path.join(root,'vendor','pdfjs',f))));}
  ok('the Android page is far smaller than the single-file build',page.length<fs.readFileSync(path.join(root,'dist','index.html'),'utf8').length-1000000);
  return res;};

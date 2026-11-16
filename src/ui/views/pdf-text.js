/**
 * ui/views/pdf-text.js
 * Responsibility: reads the text of a digital PDF in the browser with pdf.js (vendor/pdfjs), page by
 * page, and hands back text lines (rebuilt by domain/import-pdf.js). Loads the library only when a
 * PDF is chosen. In the built single file the library travels inside the page (<script type="text/plain">)
 * and is started from a blob, so it also works from file://. Never uploads the file anywhere.
 * Throws Error(message for the user) when the PDF cannot be read.
 */
import { IMPORT_LIMITS } from '../../domain/import-reader.js';
import { linesFromItems } from '../../domain/import-pdf.js';
let pdfjs=null;
const blobUrl=el=>URL.createObjectURL(new Blob([el.textContent],{type:'text/javascript'}));
// source: vendor/pdfjs next to src/ ; built file: the two scripts embedded by scripts/build.py
function libraryUrls(){
  const lib=document.getElementById('pdfjsLib'),worker=document.getElementById('pdfjsWorker');
  if(lib&&worker)return {lib:blobUrl(lib),worker:blobUrl(worker)};
  const app=document.querySelector('script[type=module][src$="app.js"]'),base=app?app.src:document.baseURI;
  return {lib:new URL('../vendor/pdfjs/pdf.min.mjs',base).href,worker:new URL('../vendor/pdfjs/pdf.worker.min.mjs',base).href};
}
async function loadPdfjs(){
  if(pdfjs)return pdfjs;
  const u=libraryUrls();
  pdfjs=await import(u.lib);
  pdfjs.GlobalWorkerOptions.workerSrc=u.worker;
  return pdfjs;
}
export async function pdfText(file){
  let lib;
  try{lib=await loadPdfjs();}catch(e){throw new Error('Não consegui carregar o leitor de PDF. Use CSV ou OFX por enquanto.');}
  const data=new Uint8Array(await file.arrayBuffer());
  let doc;
  try{doc=await lib.getDocument({data,isEvalSupported:false}).promise;}
  catch(e){throw new Error(e&&e.name==='PasswordException'?'Este PDF tem senha. Baixe uma versão sem senha ou exporte CSV/OFX.':'Não consegui abrir este PDF (arquivo corrompido ou protegido).');}
  if(doc.numPages>IMPORT_LIMITS.maxPdfPages){await doc.destroy();throw new Error(`PDF com ${doc.numPages} páginas (máximo ${IMPORT_LIMITS.maxPdfPages}). Baixe um período menor.`);}
  const lines=[];
  for(let i=1;i<=doc.numPages;i++){
    const page=await doc.getPage(i),content=await page.getTextContent();
    lines.push(...linesFromItems(content.items.map(it=>({str:it.str,x:it.transform[4],y:it.transform[5]}))));
  }
  await doc.destroy();
  return lines.join('\n');
}

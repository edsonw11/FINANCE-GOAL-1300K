/**
 * What goes into a bank file comes out as the same entries: 40 seeded random statements are written as Brazilian CSV (dd/mm/yyyy, "1.234,56") and as OFX,
 * read back by the importer, and compared with what was written: count, dates, amounts, direction and the sum. The descriptions avoid words the classifier
 * treats specially (Pix, fatura, saldo, tarifa...), so only the reading is under test.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-roundtrip');
  let st=7;const rnd=()=>{st=(st*1664525+1013904223)>>>0;return st/4294967296;};
  const pick=a=>a[Math.floor(rnd()*a.length)],cents=n=>Math.round(n*100);
  const WORDS=['LOJA','PADARIA','MERCADO','POSTO','CINEMA','LIVRARIA','OFICINA','FEIRA'];
  const br=c=>{const n=Math.abs(c),r=String(Math.floor(n/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.'),f=String(n%100).padStart(2,'0');return (c<0?'-':'')+r+','+f;};
  const statement=()=>{const n=1+Math.floor(rnd()*25),out=[];
    for(let i=0;i<n;i++){const day=1+Math.floor(rnd()*28),month=9+Math.floor(rnd()*3),c=(rnd()<0.35?1:-1)*cents(0.01+rnd()*(rnd()<0.15?20000:600));
      out.push({date:`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,desc:`${pick(WORDS)} ${pick(WORDS)} ${i}`,cents:c||-1});}
    return out;};
  const csv=e=>['Data;Descrição;Valor'].concat(e.map(x=>`${x.date.slice(8)}/${x.date.slice(5,7)}/${x.date.slice(0,4)};${x.desc};${br(x.cents)}`)).join('\n');
  const ofx=e=>'OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n'+e.map((x,i)=>`<STMTTRN><TRNTYPE>${x.cents<0?'DEBIT':'CREDIT'}<DTPOSTED>${x.date.replace(/-/g,'')}<TRNAMT>${(x.cents/100).toFixed(2)}<FITID>F${i}<NAME>${x.desc}</STMTTRN>`).join('\n')+'\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
  const read=(name,text)=>run(`(()=>{S=seed();S.tx=[];S.imports=[];const r=readImportFile({name:${JSON.stringify(name)},size:${text.length},text:${JSON.stringify(text)}},{today:'2026-11-26'});return r.ok?{ok:true,drafts:r.drafts.map(d=>({date:d.date,desc:d.desc,value:d.value,type:d.type}))}:r;})()`);
  const key=x=>`${x.date}|${x.desc}`;
  const problems=[];let entries=0;
  for(let k=0;k<40;k++){
    const e=statement();entries+=e.length;
    for(const [fmt,text] of [['csv',csv(e)],['ofx',ofx(e)]]){
      const r=read(`extrato.${fmt}`,text);
      if(!r.ok){problems.push(`${fmt} #${k}: refused ${r.error}`);continue;}
      if(r.drafts.length!==e.length){problems.push(`${fmt} #${k}: ${r.drafts.length} read, ${e.length} written`);continue;}
      const got=new Map(r.drafts.map(d=>[key(d),d]));
      for(const x of e){const d=got.get(key(x));
        if(!d){problems.push(`${fmt} #${k}: lost ${key(x)}`);continue;}
        if(cents(d.value)!==Math.abs(x.cents))problems.push(`${fmt} #${k}: ${key(x)} value ${d.value} vs ${x.cents/100}`);
        if(d.type!==(x.cents<0?'despesa':'receita'))problems.push(`${fmt} #${k}: ${key(x)} type ${d.type} for ${x.cents/100}`);}
      const sumOut=r.drafts.filter(d=>d.type==='despesa').reduce((t,d)=>t+cents(d.value),0),sumIn=r.drafts.filter(d=>d.type==='receita').reduce((t,d)=>t+cents(d.value),0);
      if(sumOut!==-e.filter(x=>x.cents<0).reduce((t,x)=>t+x.cents,0)||sumIn!==e.filter(x=>x.cents>0).reduce((t,x)=>t+x.cents,0))problems.push(`${fmt} #${k}: totals differ`);
    }
  }
  eq('every entry written in CSV and OFX is read back with its date, amount and direction',problems.slice(0,3),[]);
  ok('the generator wrote many entries ('+entries+')',entries>400);
  // formats a bank really uses that must also read the same
  const same='Data;Descrição;Valor\n05/11/2026;LOJA SAMPLE;-1.234,56';
  const variants={'comma separator and quotes':'Data,Descrição,Valor\n05/11/2026,"LOJA SAMPLE","-1.234,56"','semicolon with CRLF':same.replace(/\n/g,'\r\n'),'a byte-order mark at the start':'﻿'+same,'trailing blank lines':same+'\n\n\n'};
  for(const [label,text] of Object.entries(variants)){const r=read('x.csv',text);eq('CSV variant: '+label,r.ok?r.drafts.map(d=>[d.date,cents(d.value),d.type]):r,[['2026-11-05',123456,'despesa']]);}
  return res;};

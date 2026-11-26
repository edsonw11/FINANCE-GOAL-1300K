/** CSV and OFX readers: delimiters, quoted cells, column detection, sign conventions, balances, bad files. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-readers');
  const J=JSON.stringify;
  // ---- CSV parsing
  eq('semicolon delimiter',run(`parseCsv(${J('Data;Descrição;Valor\n05/11/2026;Padaria;-12,50\n')})`),[['Data','Descrição','Valor'],['05/11/2026','Padaria','-12,50']]);
  eq('comma delimiter with quoted comma and quote',run(`parseCsv(${J('a,b\n"x, y","say ""hi"""\n')})`),[['a','b'],['x, y','say "hi"']]);
  eq('tab delimiter, BOM and CRLF',run(`parseCsv(${J('﻿a\tb\r\n1\t2\r\n')})`),[['a','b'],['1','2']]);
  eq('empty lines are dropped',run(`parseCsv(${J('a;b\n\n;\n1;2\n')})`),[['a','b'],['1','2']]);
  // ---- column detection
  const m1=run(`detectCsvMapping(parseCsv(${J('Data;Histórico;Documento;Valor\n05/11/2026;Padaria;123;-12,50\n')}))`);
  eq('header: date, description, id, value',[m1.hasHeader,m1.date,m1.desc,m1.id,m1.value,m1.complete],[true,0,1,2,3,true]);
  const m2=run(`detectCsvMapping(parseCsv(${J('Data,Descricao,Entrada,Saída\n05/11/2026,Salário,"5.000,00",\n06/11/2026,Luz,,190.5\n')}))`);
  eq('debit and credit columns',[m2.value,m2.debit,m2.credit,m2.complete],[-1,3,2,true]);
  const m3=run(`detectCsvMapping(parseCsv(${J('05/11/2026;Padaria do Zé;-12,50\n06/11/2026;Mercado;-80,00\n')}))`);
  eq('no header: guessed from the content',[m3.hasHeader,m3.date,m3.desc,m3.value,m3.complete],[false,0,1,2,true]);
  eq('nothing recognisable is not complete',run(`detectCsvMapping(parseCsv(${J('foo;bar\nbaz;qux\n')})).complete`),false);
  // ---- CSV entries
  const e=run(`csvEntries(parseCsv(${J('Data;Descrição;Valor\n05/11/2026;Padaria;-12,50\n06/11/2026;Salário;5.000,00\n;sem data;1,00\n07/11/2026;sem valor;abc\n08/11/2026;zero;0,00\n')}),detectCsvMapping(parseCsv(${J('Data;Descrição;Valor\n05/11/2026;Padaria;-12,50\n')})),'2026-11-10')`);
  eq('entries keep sign, date and description',e.entries.map(x=>[x.date,x.desc,x.amount]),[['2026-11-05','Padaria',-12.5],['2026-11-06','Salário',5000]]);
  eq('skipped are counted by reason',e.skipped,{noDate:1,noValue:1,empty:1});
  eq('line numbers point at the file',e.entries.map(x=>x.line),[2,3]);
  const e2=run(`csvEntries(parseCsv(${J('Data,Descricao,Entrada,Saída\n05/11/2026,Salário,"5.000,00",\n06/11/2026,Luz,,190.5\n')}),detectCsvMapping(parseCsv(${J('Data,Descricao,Entrada,Saída\n')})),'2026-11-10')`);
  eq('credit column is positive, debit negative',e2.entries.map(x=>x.amount),[5000,-190.5]);
  const e3=run(`csvEntries(parseCsv(${J('Data;Descrição;Valor;Tipo\n05/11/2026;Padaria;12,50;D\n06/11/2026;Salário;5.000,00;C\n')}),detectCsvMapping(parseCsv(${J('Data;Descrição;Valor;Tipo\n05/11/2026;Padaria;12,50;D\n06/11/2026;Salário;5.000,00;C\n')})),'2026-11-10')`);
  eq('a D/C column gives the sign',e3.entries.map(x=>x.amount),[-12.5,5000]);
  // ---- OFX
  const ofxBank=`OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>12345-6</ACCTID></BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261101<DTEND>20261110
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105120000[-3:BRT]<TRNAMT>-12.50<FITID>A1<NAME>PADARIA<MEMO>COMPRA DEBITO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261106<TRNAMT>5000.00<FITID>A2<NAME>SALARIO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261107<TRNAMT>abc<FITID>A3<NAME>BROKEN</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>9999.99<DTASOF>20261110</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const o=run(`parseOfx(${J(ofxBank)})`);
  eq('OFX SGML: bank statement, account and entries',[o.kind,o.accountId,o.entries.length,o.unreadable],['bank','12345-6',2,1]);
  eq('OFX: calendar day as written, signed amounts, ids',o.entries.map(x=>[x.date,x.amount,x.id]),[['2026-11-05',-12.5,'A1'],['2026-11-06',5000,'A2']]);
  eq('OFX: name and memo joined',o.entries[0].desc,'PADARIA - COMPRA DEBITO');
  ok('OFX: the closing balance is not an entry',!o.entries.some(x=>Math.abs(x.amount)===9999.99));
  const card=`<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST><STMTTRN><DTPOSTED>20261105<TRNAMT>-50.00<FITID>C1<MEMO>LOJA X</STMTTRN></BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
  eq('OFX XML: credit card statement',run(`parseOfx(${J(card)})`).kind,'card');
  ok('looksLikeOfx',run(`looksLikeOfx(${J(ofxBank)})&&!looksLikeOfx('a;b\\n1;2')`));
  // ---- readImportFile: validation and unsupported formats
  const rd=(name,text,opts)=>run(`readImportFile({name:${J(name)},text:${J(text)}},${J(opts||{today:'2026-11-10'})})`);
  eq('photo is not read',/Ainda não leio foto/.test(rd('comprovante.jpg','x').error),true);
  eq('the message names what is supported',/CSV, OFX e PDF digital/.test(rd('comprovante.jpg','x').error),true);
  eq('Excel is not read',/Excel/.test(rd('mov.xlsx','x').error),true);
  eq('unknown extension',/não é suportado/.test(rd('a.docx','x').error),true);
  eq('empty file',rd('a.csv','   ').error,'O arquivo está vazio.');
  eq('binary content',/não é um texto legível/.test(rd('a.csv','ab\u0000cd').error),true);
  eq('too big',/grande demais/.test(run(`readImportFile({name:'a.csv',size:3*1024*1024,text:'x'},{})`).error),true);
  const unk=rd('a.csv','foo;bar\nbaz;qux\n');
  eq('unknown columns ask for a mapping',[unk.ok,unk.needsMapping],[false,true]);
  eq('OFX without transactions',rd('a.ofx','<OFX></OFX>').error,'Não encontrei lançamentos neste OFX.');
  eq('OFX: each entry carries its 1-based position among the transactions',o.entries.map(x=>x.line),[1,2]);
  // ---- OFX detection reads only the start of the file (4000 characters), and an entry stops at its closing tag
  const pad=n=>' '.repeat(n);
  eq('<OFX> inside the first 4000 characters is detected; one that starts later is not',[run(`looksLikeOfx(${J(pad(3995)+'<OFX>')})`),run(`looksLikeOfx(${J(pad(3996)+'<OFX>')})`)],[true,false]);
  const leak='<MEMO>LEAK</MEMO>',entry=(end)=>`<STMTTRN><DTPOSTED>20261105<TRNAMT>-5.00<NAME>LOJA${end}${leak}`;
  const closers=['</STMTTRN>','</BANKTRANLIST>','</CCSTMTRS>','</STMTRS>'];
  closers.forEach(end=>eq(`text after ${end} does not leak into the entry`,run(`parseOfx(${J('<OFX><BANKTRANLIST>'+entry(end))})`).entries.map(e=>e.desc),['LOJA']));
  eq('name and memo that are equal are shown once; different ones are joined; a memo alone is the description',
    [['A','A'],['A','B'],['','B']].map(([n,m])=>run(`parseOfx(${J('<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261105<TRNAMT>-5.00'+(n?'<NAME>'+n:'')+(m?'<MEMO>'+m:'')+'</STMTTRN>')})`).entries[0].desc),['A','A - B','B']);
  return res;};

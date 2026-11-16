/** Digital PDF text -> entries: line rebuilding, dates (numeric and "05 NOV"), signs, card invoice, honest failures. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-pdf');
  const J=JSON.stringify;
  run(`S=seed();S.tx=[];S.imports=[];initCats();`);
  const pe=(lines,opts)=>run(`pdfEntries(${J(lines.join('\n'))},${J(Object.assign({today:'2026-11-10'},opts||{}))})`);
  // ---- rebuilding lines from positioned pieces
  eq('pieces on the same baseline become one line, top to bottom, left to right',
    run(`linesFromItems(${J([{str:'-12,50',x:300,y:699.8},{str:'05/09/2026',x:10,y:700},{str:'Extrato',x:10,y:750},{str:'PADARIA',x:80,y:700.4},{str:' ',x:5,y:700}])})`),
    ['Extrato','05/09/2026 PADARIA -12,50']);
  // ---- bank statement with a balance column
  let r=pe(['Extrato de conta corrente','Período 01/09/2026 a 30/11/2026','Data Descrição Valor Saldo',
    '05/09/2026 COMPRA MERCADO EXTRA -123,45 1.000,00','06/09/2026 PIX RECEBIDO JOAO 500,00 1.500,00','07/09/2026 SALDO DO DIA 1.500,00','1/3']);
  eq('bank kind, header lines are not entries',[r.kind,r.entries.length],['bank',3]);
  eq('signed debit is negative, credit positive',r.entries.map(e=>e.amount),[-123.45,500,1500]);
  eq('the first amount is the value; the balance column is flagged',[r.entries[0].desc,r.entries[0].flags],['COMPRA MERCADO EXTRA',['two-amounts']]);
  eq('dates are read as written',r.entries.map(e=>e.date),['2026-09-05','2026-09-06','2026-09-07']);
  // ---- signs not printed
  r=pe(['05/09 PAGAMENTO LUZ 190,00','06/09 DEPOSITO SALARIO 5.000,00','07/09 XPTO 10,00']);
  eq('no signs in the PDF: words decide, the rest is a flagged guess (expense)',r.entries.map(e=>[e.amount,e.flags]),[[-190,[]],[5000,[]],[-10,['sign-guess']]]);
  r=pe(['05/09 PAGAMENTO LUZ -190,00','07/09 XPTO 10,00']);
  eq('when debits carry "-", a plain value is a credit',r.entries.map(e=>e.amount),[-190,10]);
  r=pe(['05/09/2026 LOJA 10,00 D','06/09/2026 DEPOSITO 20,00 C','07/09/2026 OUTRO (30,00)']);
  eq('D/C suffix and parentheses',r.entries.map(e=>e.amount),[-10,20,-30]);
  // ---- card invoice with month names
  r=pe(['Fatura do cartão Nubank','Vencimento 07 DEZ 2026','Total da fatura R$ 1.234,56','05 NOV Mercado Extra R$ 45,90','06 NOV Pagamento recebido −R$ 1.000,00','07 nov Loja Parc 02/03 R$ 77,77','25 DEZ Compra futura R$ 10,00']);
  eq('card invoice recognised',r.kind,'card');
  eq('purchases positive, payment negative',r.entries.map(e=>e.amount),[45.9,-1000,77.77,10]);
  eq('"05 NOV" gets the right year; a date still in the future means last year',r.entries.map(e=>e.date),['2026-11-05','2026-11-06','2026-11-07','2025-12-25']);
  eq('the description stops at the amount',r.entries[2].desc,'Loja Parc 02/03');
  eq('the kind can be forced',pe(['05/09/2026 LOJA 10,00'],{kind:'card'}).kind,'card');
  // ---- through the reader
  const rd=(name,lines,opts)=>run(`globalThis.R=readImportFile({name:${J(name)},text:${J(lines.join('\n'))}},${J(Object.assign({today:'2026-11-10'},opts||{}))});R`);
  rd('fatura.pdf',['Fatura do cartão','05 NOV Mercado Extra R$ 45,90','06 NOV Pagamento recebido −R$ 1.000,00']);
  eq('PDF is read: format, kind',[run('R.ok'),run('R.format'),run('R.kind')],[true,'pdf','card']);
  eq('purchase is a card expense, the payment is not importable',run("R.drafts.map(d=>[d.type,d.fonte,d.selected])"),[['despesa','cartao',true],['ignorar','caixa',false]]);
  eq('PDF flags reach the draft',(rd('x.pdf',['05/09/2026 A -1,00 9,00']),run('R.drafts[0].flags')),['two-amounts']);
  eq('PDF without text (scanned) says so',/parece escaneado/.test(rd('x.pdf',['  ']).error),true);
  eq('PDF with text but no lines says the layout is unknown',/layout pode ser diferente/.test(rd('x.pdf',['Extrato sem datas','Total 10,00']).error),true);
  eq('limits: a PDF may be bigger than a CSV',[run(`readImportFile({name:'a.pdf',size:5*1024*1024,text:'x'},{}).error`)!==undefined,/grande demais/.test(run(`readImportFile({name:'a.pdf',size:11*1024*1024,text:'x'},{}).error`)),/grande demais/.test(run(`readImportFile({name:'a.csv',size:3*1024*1024,text:'x'},{}).error`))],[true,true,true]);
  eq('kind can be changed by re-reading',run(`readImportFile({name:'x.pdf',text:${J('05/09/2026 LOJA 10,00')}},{today:'2026-11-10',kind:'card'}).drafts[0].fonte`),'cartao');
  // ---- heading dates: the day is printed once, entries below have no date (layout of some digital banks)
  const sectioned=['Extrato','06 de novembro de 2026 Total de entradas + 1.000,00','Transferência recebida pelo Pix JOAO 1.000,00',
    'JOAO SILVA - ***.123.456-** - BANCO X Agência: 1 Conta: 2','Total de saídas - 40,00','Compra no débito PADARIA 40,00',
    '07 NOV 2026','Aplicação RDB 300,00','Resgate RDB 50,00'].join('\n');
  const sec=run(`pdfEntries(${JSON.stringify(sectioned)},{today:'2026-11-10'})`).entries.filter(e=>!/^total/i.test(e.desc));
  eq('entries under a date heading take that date and a direction by words',sec.map(e=>[e.date,e.desc.slice(0,12),e.amount]),
    [['2026-11-06','Transferênci',1000],['2026-11-06','Compra no dé',-40],['2026-11-07','Aplicação RD',-300],['2026-11-07','Resgate RDB',50]]);
  return res;};

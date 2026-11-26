/** Digital PDF text -> entries: line rebuilding, dates (numeric and "05 NOV"), signs, card invoice, honest failures. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('import-pdf');
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
  // ---- Santander-like layout (invented values): words cut in pieces, measured columns, the date only on the
  // first entry of the day, the line below completes the description, and a table after the block repeats debits
  const piece=(str,x,y,w)=>({str,x,y,w,size:8});
  const word=(text,x,y)=>{const out=[];let cx=x;text.split(/(\s)/).forEach(t=>{if(t===' '){out.push(piece(' ',cx,y,1.8));cx+=2;return;}
    for(let i=0;i<t.length;i+=3){const p=t.slice(i,i+3);out.push(piece(p,cx,y,p.length*4));cx+=p.length*4;}});return out;};
  const pages=[].concat(word('EXTRATO CONSOLIDADO',400,800),word('Depósitos / Transferências',60,700),word('9.000,00',480,700),
    word('Movimentação',30,600),
    word('03/10',30,580),word('TED SALARIO EMPRESA X',65,580),word('-',320,580),word('8.000,00',424,580),word('9.100,00',509,580),
    word('FULANO DE TAL',65,571),
    word('06/10',30,560),word('DEBITO AUT. CONTA DE LUZ',65,560),word('-',320,560),word('150,25-',424,560),
    word('LUZ SA',65,551),
    word('DEBITO AUT. FATURA CARTAO',65,540),word('-',320,540),word('700,00-',424,540),word('8.249,75',509,540),
    word('REMUNERACAO APLICACAO AUTOMATICA',65,530),word('-',320,530),word('0,05',424,530),
    word('Se você não tem Limite da Conta e a sua conta ficou com saldo devedor, terá sido prestado o serviço de adiantamento',30,500),
    word('06/10',30,400),word('LUZ SA',65,400),word('123456789',300,400),word('150,25',424,400),word('Sim',480,400));
  const sl=run(`linesFromItems(${J(pages)})`);
  eq('pieces of a word are joined, spaces kept, far apart pieces are columns',sl.slice(0,4),
    ['EXTRATO CONSOLIDADO','Depósitos / Transferências | 9.000,00','Movimentação','03/10 TED SALARIO EMPRESA X | - | 8.000,00 | 9.100,00']);
  const st=run(`pdfEntries(${J(sl.join('\n'))},{today:'2026-11-10'})`);
  eq('a statement that mentions "fatura" is still a bank statement',st.kind,'bank');
  eq('only the movement block: dates carried, descriptions completed, debits by "-", plain value is a credit',
    st.entries.map(e=>[e.date,e.desc,e.amount]),
    [['2026-10-03','TED SALARIO EMPRESA X FULANO DE TAL',8000],['2026-10-06','DEBITO AUT. CONTA DE LUZ LUZ SA',-150.25],
     ['2026-10-06','DEBITO AUT. FATURA CARTAO',-700],['2026-10-06','REMUNERACAO APLICACAO AUTOMATICA',0.05]]);
  eq('value and balance in separate columns: no "two amounts" warning',st.entries.map(e=>e.flags),[[],[],[],[]]);
  // ---- "Extrato de conta" layout (invented values): day heading with the weekday, description above the date
  // line, the other party below it, the newest day first
  const ec=pe(['EXTRATO DE CONTA','Período: 18/10/2026 a 16/11/2026','DETALHE DOS MOVIMENTOS','Data | Descrição | Valor | Saldo',
    'Quarta, 11 de novembro','Debito aut. cta energia eletrica','11/11/2026 | -R$ 266,39 | R$ 2.553,73','Eletropaulo Metropoli',
    'Sexta, 6 de novembro','06/11/2026 Remuneracao aplicacao automatica | R$ 2,67 | R$ 3.162,20','Pix enviado','06/11/2026 | -R$ 300,00 R$ 3.159,53','Fulano De Tal',
    'Terça, 3 de novembro','Ted conta salario','03/11/2026 | R$ 1.000,00 R$ 3.459,53','Fulano de tal']);
  eq('description above the date line, other party below, own text kept as is',ec.entries.map(e=>[e.date,e.desc,e.amount]),
    [['2026-11-11','Debito aut. cta energia eletrica Eletropaulo Metropoli',-266.39],['2026-11-06','Remuneracao aplicacao automatica',2.67],
     ['2026-11-06','Pix enviado Fulano De Tal',-300],['2026-11-03','Ted conta salario Fulano de tal',1000]]);
  // ---- a page footer between two entries is not part of a description
  const pf=pe(['Movimentação','05/10 PIX RECEBIDO | - | 10,00 | 20,00','Extrato_P F_A4_Inteligente - 27/11/2024','BALP_UY_M3SM.PIM -','Pagina: 2/4','06/10 PIX ENVIADO | - | 5,00- | 15,00']);
  eq('page footer ignored',pf.entries.map(e=>e.desc),['PIX RECEBIDO','PIX ENVIADO']);
  // ---- Bradesco-like table (invented values): "Crédito" and "Débito" columns without signs, the date only on
  // the first entry of the day, the description above the value line and "DES:/REM:" below it
  const at=(str,x,y)=>({str,x,y,w:str.length*5,size:8}),hy=700;
  const bp=[at('Data',20,hy),at('Histórico',80,hy),at('Docto.',260,hy),at('Crédito',330,hy),at('(R$)',368,hy),at('Débito',400,hy),at('(R$)',433,hy),at('Saldo',470,hy),at('(R$)',498,hy),
    at('05/01/2026',20,680),at('RENTAB.INVEST',80,680),at('4674934',260,680),at('0,01',350,680),at('2.977,80',470,680),
    at('PIX QR CODE ESTATICO',80,670),at('1035546',260,660),at('140,00',412,660),at('2.837,80',470,660),at('DES: PADARIA DO ZE 03/01',80,650),
    at('PIX QR CODE ESTATIC',80,640),at('12/01/2026',20,630),at('1928183',260,630),at('500,00',340,630),at('3.337,80',470,630),at('REM: FULANO DE TAL 12/01',80,620),
    at('Total',20,600),at('500,01',340,600),at('140,00',412,600),at('3.337,80',470,600)];
  const bl=run(`linesFromItems(${J(bp)})`);
  eq('values get the column they sit in (C or D); the balance stays plain',bl.filter(l=>/,\d\d/.test(l)).slice(0,3),
    ['05/01/2026 RENTAB.INVEST | 4674934 | 0,01 C | 2.977,80','1035546 | 140,00 D | 2.837,80','12/01/2026 | 1928183 | 500,00 C | 3.337,80']);
  const be=run(`pdfEntries(${J(bl.join('\n'))},{today:'2026-11-18'})`).entries;
  eq('direction from the column, no guess; date carried; description above + DES/REM below; document number and total left out',
    be.map(e=>[e.date,e.desc,e.amount,e.flags]),
    [['2026-01-05','RENTAB.INVEST',0.01,[]],['2026-01-05','PIX QR CODE ESTATICO PADARIA DO ZE',-140,[]],['2026-01-12','PIX QR CODE ESTATIC FULANO DE TAL',500,[]]]);
  // ---- Nubank-like statement (invented values): a summary on top, groups headed by "Total de entradas / saídas"
  // without signs on the entries, a page break with the period header and a paragraph in the middle of a group
  const nu=pe(['Resumo do período','Total de entradas | +1.010,00','Total de saídas | -230,00','Movimentações',
    '02 MAR 2026 | Total de entradas | + 1.000,00','Transferência recebida pelo Pix | FULANO DE TAL - •••.123.456-•• - BCO X | 1.000,00',
    'Total de saídas | - 80,00','Pagamento de boleto efetuado | LOJA X LTDA | 80,00',
    'Tem alguma dúvida? Mande uma mensagem para nosso time de atendimento pelo app ou ligue para o número abaixo',
    '01 DE MARÇO DE 2026 a 31 DE MARÇO DE 2026 | VALORES EM R$',
    'Transferência enviada pelo Pix | CICRANO - •••.111.222-•• - BCO Y | 150,00',
    '05 MAR 2026 | Total de entradas | + 10,00','Estorno de compra | LOJA Z | 10,00','Saldo final do dia | 1.000,00'],{today:'2026-11-18'});
  eq('direction by group, the period header is no date, the group goes on after the page break',
    nu.entries.filter(e=>!/^(total|saldo)/i.test(e.desc)).map(e=>[e.date,e.desc.slice(0,14),e.amount,e.flags]),
    [['2026-03-02','Transferência ',1000,[]],['2026-03-02','Pagamento de b',-80,[]],['2026-03-02','Transferência ',-150,[]],['2026-03-05','Estorno de com',10,[]]]);
  eq('without width/size every piece is still a word (old behavior)',run(`linesFromItems(${J([{str:'A',x:1,y:1},{str:'B',x:2,y:1}])})`),['A B']);
  return res;};

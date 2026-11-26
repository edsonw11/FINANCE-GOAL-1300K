/**
 * Import flow (no browser): classification, sign conventions, balances, card statements, installments,
 * competence months, duplicates (in the file and in the data), the confirmation rule, idempotency,
 * partial failure, the history suggestion and dividing one draft across categories. Fixtures are made up; no real data.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-flow');
  const J=JSON.stringify;
  const fresh=()=>run(`S=seed();S.tx=[];S.imports=[];S.cats=undefined;delete S.catsV2;delete S.catsV3;delete S.catsV4;initCats();`);
  const read=(name,text,opts)=>run(`globalThis.R=readImportFile({name:${J(name)},text:${J(text)}},${J(Object.assign({today:'2026-11-10'},opts||{}))});R`);
  const by=(desc)=>run(`R.drafts.find(d=>d.desc.indexOf(${J(desc)})>=0)`);
  fresh();
  // ---- bank statement (CSV)
  const bank=['Data;Descrição;Valor',
    '01/11/2026;SALDO ANTERIOR;1.000,00','05/11/2026;PADARIA DO ZE;-12,50','06/11/2026;SALARIO EMPRESA XPTO;5.000,00',
    '06/11/2026;SALDO DO DIA;4.987,50','07/11/2026;PAGAMENTO FATURA CARTAO;-1.200,00','07/11/2026;RESGATE RDB;500,00',
    '08/11/2026;PIX ENVIADO JOAO;-80,00','08/11/2026;TARIFA PACOTE SERVICOS;-29,90','09/11/2026;LOJA AZUL PARC 03/10;-100,00',
    '09/11/2026;LOJA VERDE 02/05;-50,00','09/11/2026;CAFE CENTRAL;-7,00','09/11/2026;CAFE CENTRAL;-7,00'].join('\n');
  const before=run('JSON.stringify(S.tx)');
  const r=read('extrato-novembro.csv',bank);
  eq('reading never saves anything (confirmation is required)',run('JSON.stringify(S.tx)'),before);
  ok('read ok as csv/bank',r.ok&&r.format==='csv');
  eq('balance lines are dropped, not turned into entries',[run('R.dropped'),run('R.drafts.some(d=>/saldo/i.test(d.desc))')],[2,false]);
  eq('expense and income by sign',[by('PADARIA').type,by('PADARIA').value,by('SALARIO').type],['despesa',12.5,'receita']);
  eq('salary gets the Salário category',by('SALARIO').cat,'Salário');
  eq('card bill payment is not an expense',[by('PAGAMENTO FATURA').type,by('PAGAMENTO FATURA').reason,by('PAGAMENTO FATURA').selected],['ignorar','pagamento_fatura',false]);
  eq('redemption/investment is a transfer, not income',[by('RESGATE').type,by('RESGATE').reason],['ignorar','transferencia']);
  eq('pix is flagged, not silently classified',[by('PIX').type,by('PIX').flags],['despesa',['maybe-transfer']]);
  eq('fees get the fees category',by('TARIFA').cat,'Tarifas bancárias e juros');
  eq('installment with the word PARC is sure',by('LOJA AZUL').installment,{n:3,of:10,sure:true});
  eq('bare 02/05 is flagged as unsure',[by('LOJA VERDE').installment.sure,by('LOJA VERDE').flags],[false,['installment-unsure']]);
  eq('two equal purchases in one day are both kept (different keys)',run("R.drafts.filter(d=>d.desc==='CAFE CENTRAL').map(d=>d.key.slice(-2))"),['#1','#2']);
  eq('equal purchases are not duplicates of each other',run("R.drafts.filter(d=>d.desc==='CAFE CENTRAL').map(d=>d.dup)"),[null,null]);
  eq('bank statement: fonte caixa',run("R.drafts.every(d=>d.fonte==='caixa')"),true);
  eq('totals of the selection',run("selectionSummary(R.drafts)"),{count:8,income:5000,expense:12.5+80+29.9+100+50+14,contribution:0,months:['2026-11']});
  // ---- dates are kept exactly (no UTC shift)
  eq('dates keep the day written',run("R.drafts.filter(d=>d.desc==='PADARIA DO ZE')[0].date"),'2026-11-05');
  // ---- commit: only selected, through the normal builder
  const c=run(`globalThis.C=commitImport(R.drafts,{fileHash:R.fileHash,fileName:R.fileName,at:'2026-11-10'});C`);
  eq('saved only the selected ones',[c.saved,run('S.tx.length')],[8,8]);
  eq('ignored items were not saved',run("S.tx.some(t=>/FATURA|RESGATE/.test(t.desc))"),false);
  eq('saved fields',run("(t=>[t.type,t.date,t.value,t.desc,t.cat,t.fonte,t.imp===R.drafts.find(d=>d.desc==='PADARIA DO ZE').key])(S.tx.find(t=>t.desc==='PADARIA DO ZE'))"),['despesa','2026-11-05',12.5,'PADARIA DO ZE','Imprevistos / Outros','caixa',true]);
  eq('the import is logged',run("S.imports.map(i=>[i.name,i.count])"),[['extrato-novembro.csv',8]]);
  // ---- idempotent: same file again
  const again=read('extrato-novembro.csv',bank);
  ok('same file is recognised',!!again.alreadyImported&&again.alreadyImported.count===8);
  eq('every row is a confirmed duplicate and unselected',run("R.drafts.filter(d=>d.type!=='ignorar').map(d=>[d.dup&&d.dup.level,d.selected]).filter(x=>x[0]!=='confirmed'||x[1])"),[]);
  eq('forcing the commit of the same drafts saves nothing (double click safe)',run("(R.drafts.forEach(d=>d.selected=d.type!=='ignorar'),commitImport(R.drafts,{}))").saved,0);
  eq('and says why',run("commitImport(R.drafts,{}).items.filter(i=>i.status==='skipped').length"),8);
  eq('still 8 records',run('S.tx.length'),8);
  // ---- overlapping statement: same rows, other file, new row
  read('extrato-2.csv',bank.replace('09/11/2026;CAFE CENTRAL;-7,00\n09/11/2026;CAFE CENTRAL;-7,00','10/11/2026;LIVRARIA;-45,00'));
  eq('overlap: old rows are duplicates, the new one is not',run("R.drafts.filter(d=>!d.dup&&d.type!=='ignorar').map(d=>d.desc)"),['LIVRARIA']);
  // ---- possible duplicate of a manual record
  fresh();run(`S.tx.push({id:S.nid++,type:'despesa',date:'2026-11-05',value:12.5,desc:'Padaria',cat:'Restaurantes',fonte:'caixa'})`);
  read('a.csv','Data;Descrição;Valor\n05/11/2026;PADARIA DO ZE;-12,50\n20/11/2026;PADARIA DO ZE;-12,50\n');
  eq('same value on the same day is only a possible duplicate (unselected)',run("R.drafts.map(d=>[d.dup&&d.dup.level,d.selected])"),[['possible',false],[null,true]]);
  run("R.drafts[0].selected=true;R.drafts[0].dup=null");
  eq('the user can import it anyway',run("commitImport(R.drafts,{}).saved"),2);
  eq('the existing record is untouched',run("S.tx[0]"),{id:run('S.tx[0].id'),type:'despesa',date:'2026-11-05',value:12.5,desc:'Padaria',cat:'Restaurantes',fonte:'caixa'});
  // ---- history suggestion
  fresh();run(`S.tx.push({id:S.nid++,type:'despesa',date:'2026-10-05',value:80,desc:'Mercado Extra',cat:'Mercado',fonte:'caixa'},{id:S.nid++,type:'despesa',date:'2026-10-06',value:20,desc:'Uber viagem',cat:'Transporte',fonte:'caixa'},{id:S.nid++,type:'despesa',date:'2026-10-07',value:30,desc:'Uber centro',cat:'Transporte',fonte:'caixa'})`);
  read('h.csv','Data;Descrição;Valor\n05/11/2026;COMPRA NO DEBITO MERCADO EXTRA 1234;-99,00\n06/11/2026;UBER TRIP;-25,00\n07/11/2026;PADARIA NOVA;-9,00\n');
  eq('same merchant: category from history',by('MERCADO').cat,'Mercado');
  eq('same brand seen twice: category from history',by('UBER').cat,'Transporte');
  eq('unknown merchant stays without category (flagged for review)',[by('PADARIA').cat,run("needsReview(R.drafts.find(d=>d.desc==='PADARIA NOVA'))")],['',true]);
  eq('suggestion needs the same type',run("suggestFromHistory('Mercado Extra','receita')"),null);
  // ---- card statement: positive = purchase, competence = invoice month
  fresh();
  const cardCsv=['Data;Descrição;Valor','28/10/2026;MERCADO LIVRE;150,00','29/10/2026;POSTO IPIRANGA;200,00','30/10/2026;PAGAMENTO RECEBIDO;-1.000,00','30/10/2026;ESTORNO LOJA X;-20,00','15/10/2026;ANUIDADE DIFERENCIADA 03/12;12,00'].join('\n');
  read('fatura-cartao.csv',cardCsv);
  eq('card statement is detected from the name; purchases are card expenses',run("R.drafts.filter(d=>d.type==='despesa').map(d=>d.fonte)"),['cartao','cartao','cartao']);
  eq('payment and refund on the card are not imported by default',run("R.drafts.filter(d=>d.type==='ignorar').map(d=>[d.reason,d.selected])"),[['pagamento_fatura',false],['estorno',false]]);
  eq('purchase on the 28th goes to the November invoice, on the 29th to December',run("R.drafts.slice(0,2).map(invoiceMonth)"),['2026-11','2026-12']);
  eq('but it is counted in the month of the purchase, like a manual entry',run("R.drafts.slice(0,2).map(targetMonth)"),['2026-10','2026-10']);
  eq('no invoice month for a bank expense',run("invoiceMonth({date:'2026-10-28',fonte:'caixa',type:'despesa'})"),'');
  eq('the purchase date is kept (not the due date)',run("R.drafts.slice(0,2).map(d=>d.date)"),['2026-10-28','2026-10-29']);
  eq('invert flips the sign convention (the purchase becomes a credit)',run(`readImportFile({name:'x.csv',text:${J(cardCsv)}},{today:'2026-11-10',kind:'card',invert:true}).drafts[0].reason`),'estorno');
  eq('a bank-kind read of the same file treats positive as income',run(`readImportFile({name:'x.csv',text:${J(cardCsv)}},{today:'2026-11-10',kind:'bank'}).drafts[0].type`),'receita');
  // card purchases are not counted twice when the invoice payment is already registered
  fresh();run(`S.tx.push({id:S.nid++,type:'fatura',date:'2026-11-07',value:300,cat:'Fatura do cartão',fm:'2026-11'})`);
  const monthsTotal=()=>run("monthSummary('2026-10').expenses.total+monthSummary('2026-11').expenses.total");
  const t0=monthsTotal();
  read('fatura-cartao.csv',['Data;Descrição;Valor','20/10/2026;LOJA A;100,00','21/10/2026;LOJA B;50,00'].join('\n'));
  run('transact(()=>commitImport(R.drafts,{}))');
  eq('invoice already paid: importing its purchases does not add expenses',[t0,monthsTotal()],[300,300]);
  // ---- installments
  fresh();
  read('p.csv','Data;Descrição;Valor\n09/11/2026;LOJA AZUL PARC 03/10;-100,00\n');
  run('R.drafts[0].createRest=true');
  const p=run('commitImport(R.drafts,{})');
  eq('createRest makes the remaining installments as one series (3..10 = 8)',[p.saved,run('S.tx.length'),run('new Set(S.tx.map(t=>t.serie)).size')],[1,8,1]);
  eq('each installment in its own month, same value',run('S.tx.map(t=>t.date.slice(0,7)+":"+t.value).join(" ")'),'2026-11:100 2026-12:100 2027-01:100 2027-02:100 2027-03:100 2027-04:100 2027-05:100 2027-06:100');
  eq('only the first carries the row key, the rest derive from it',run("S.tx.map(t=>t.imp).filter(Boolean).length+':'+S.tx[1].imp.endsWith('/1')"),'8:true');
  fresh();read('p.csv','Data;Descrição;Valor\n09/11/2026;LOJA AZUL PARC 03/10;-100,00\n');
  eq('by default only this month is saved',run("(commitImport(R.drafts,{}),S.tx.length)"),1);
  // ---- partial failure: invalid items are reported, the rest is saved, nothing is duplicated
  fresh();read('q.csv','Data;Descrição;Valor\n05/11/2026;UM;-10,00\n06/11/2026;DOIS;-20,00\n07/11/2026;TRES;-30,00\n08/11/2026;QUATRO;-40,00\n');
  run("R.drafts[1].date='2026-13-45';R.drafts[2].selected=false;R.drafts[3].type='ignorar'");
  const q=run('commitImport(R.drafts,{fileHash:R.fileHash,fileName:"q.csv"})');
  eq('result per item',q.items.map(i=>i.status),['saved','failed','failed']);
  eq('reasons are given',q.items.slice(1).map(i=>i.reason),['Data inválida','Tipo: escolha despesa, receita ou aporte']);
  eq('only the valid selected one was saved',[q.saved,run('S.tx.length')],[1,1]);
  run("R.drafts[1].date='2026-11-06'");
  eq('after fixing the failed one, saving again does not duplicate the first',run("(commitImport(R.drafts.filter(d=>d.selected),{}),S.tx.map(t=>t.desc))"),['UM','DOIS']);
  // ---- OFX: bank id is the key; repeated id inside the file
  fresh();
  const ofx=id2=>`<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>9</ACCTID></BANKACCTFROM><BANKTRANLIST>
<STMTTRN><DTPOSTED>20261105<TRNAMT>-12.50<FITID>X1<NAME>PADARIA</STMTTRN>
<STMTTRN><DTPOSTED>20261106<TRNAMT>-20.00<FITID>${id2}<NAME>LUZ</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  read('e.ofx',ofx('X1'));
  eq('same FITID twice in a file: the second is a confirmed duplicate',run("R.drafts.map(d=>[d.dup&&d.dup.level,d.selected])"),[[null,true],['confirmed',false]]);
  read('e.ofx',ofx('X2'));run('commitImport(R.drafts,{})');
  read('e2.ofx',ofx('X2'));
  eq('same bank ids in another file are already imported',run("R.drafts.map(d=>d.dup&&d.dup.level)"),['confirmed','confirmed']);
  eq('OFX sign: negative is an expense',run("R.drafts[0].type"),'despesa');
  eq('OFX credit card statement: purchases (negative) are card expenses',run(`readImportFile({name:'c.ofx',text:${J('<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST><STMTTRN><DTPOSTED>20261020<TRNAMT>-50.00<FITID>C1<MEMO>LOJA X</STMTTRN><STMTTRN><DTPOSTED>20261025<TRNAMT>100.00<FITID>C2<MEMO>PAGAMENTO RECEBIDO</STMTTRN></BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>')}},{today:'2026-11-10'}).drafts.map(d=>[d.type,d.fonte])`),[['despesa','cartao'],['ignorar','caixa']]);
  // ---- manual item added in the review
  fresh();read('m.csv','Data;Descrição;Valor\n05/11/2026;UM;-10,00\n');
  run("R.drafts.push(blankDraft({date:'2026-11-09',desc:'Esquecido',value:33,cat:'Mercado'}))");
  eq('a manual item is saved like the others',run("(commitImport(R.drafts,{}),S.tx.map(t=>t.desc+':'+t.value))"),['UM:10','Esquecido:33']);
  // ---- competence: a document from the past stays in the past
  fresh();read('old.csv','Data;Descrição;Valor\n15/03/2024;CONTA ANTIGA;-100,00\n');
  run('commitImport(R.drafts,{})');
  eq('old statement lands in its historical month, not today',run("[monthSummary('2024-03').expenses.total,monthSummary('2026-11').expenses.total]"),[100,0]);
  // ---- overview shown on top of the review (a preview)
  fresh();read('o.csv',bank);
  const ov=run('importOverview(R.drafts)');
  eq('overview counts',[ov.total,ov.incomes,ov.expenses,ov.others],[10,1,7,2]);
  eq('overview totals',[ov.incomeTotal,ov.expenseTotal],[5000,12.5+80+29.9+100+50+14]);
  eq('overview: items to review (no category or flagged) now include the possible transfer (the "RESGATE RDB" line, Q5)',[ov.review,ov.possibleTransfers],[7,1]);
  // owner decision Q5: money in with an investment word is a possible transfer: visible, flagged, not selected, in no total until the person changes its type
  const sumBefore=run('selectionSummary(R.drafts)'),pt=by('RESGATE');
  eq('Q5: the possible transfer is flagged, ignored, not selected and not an income',[pt.type,pt.reason,pt.flags,pt.selected],['ignorar','transferencia',['possible-transfer'],false]);
  eq('Q5: it is in no total: income stays 5000 and the selection has no 500',[ov.incomeTotal,sumBefore.income,sumBefore.count],[5000,5000,run('R.drafts.filter(d=>d.selected).length')]);
  eq('Q5: changing its type to income by hand counts it (and only then)',run("(()=>{const d=R.drafts.find(x=>/RESGATE/.test(x.desc));d.type='receita';d.selected=true;d.cat='Outros';return selectionSummary(R.drafts).income;})()"),5500);
  fresh();read('o.csv',bank);
  eq('Q5: saving the untouched review does not create a record for the possible transfer',run("(()=>{commitImport(R.drafts,{fileHash:R.fileHash,fileName:R.fileName,at:'2026-11-10'});return S.tx.some(t=>/RESGATE/.test(t.desc||''));})()"),false);
  eq('overview: selected totals follow the selection',run("(R.drafts.forEach(d=>d.selected=false),R.drafts[0].selected=true,importOverview(R.drafts).selected)"),{count:1,income:0,expense:12.5,contribution:0,months:['2026-11']});
  // ---- validation
  eq('draftProblems: type, value, date',run("draftProblems({type:'ignorar',value:0,date:''})"),['Tipo: escolha despesa, receita ou aporte','Valor inválido','Data inválida']);
  eq('no problems on a good draft',run("draftProblems({type:'receita',value:1,date:'2026-01-01'})"),[]);
  // ---- contributions (aporte): money going to an investment
  fresh();
  const apo=['Data;Descrição;Valor','10/11/2026;APLICACAO TESOURO SELIC 2028;-1.000,00','10/11/2026;APLICACAO RDB;-300,00',
    '11/11/2026;RESGATE RDB;500,00','12/11/2026;PADARIA;-9,00'].join('\n');
  read('apo.csv',apo);
  eq('investment out of the account is suggested as aporte, flagged',[by('SELIC').type,by('SELIC').flags],['aporte',['check-aporte']]);
  eq('account is filled only when exactly one matches',[by('SELIC').acc,by('APLICACAO RDB').acc],['s28','']);
  eq('redemption in is not income',[by('RESGATE').type,by('RESGATE').reason],['ignorar','transferencia']);
  eq('aporte without account cannot be saved',run("draftProblems(R.drafts.find(d=>d.desc.indexOf('APLICACAO RDB')>=0))"),['Investimento: escolha para onde vai o aporte']);
  run("R.drafts.find(d=>d.desc.indexOf('APLICACAO RDB')>=0).acc='in'");
  run("globalThis.C=commitImport(R.drafts.filter(d=>d.type!=='ignorar'),{fileHash:'h1',fileName:'apo.csv'});C");
  eq('commit saves aportes with account and no category',run("S.tx.filter(t=>t.type==='aporte').map(t=>[t.acc,t.value]).sort()"),[['in',300],['s28',1000]]);
  eq('expense still saved normally',run("S.tx.filter(t=>t.type==='despesa').length"),1);
  eq('same file again saves nothing twice',run("(read=>{globalThis.R2=readImportFile({name:'apo.csv',text:"+J(apo)+"},{today:'2026-11-10'});return commitImport(R2.drafts.filter(d=>d.type!=='ignorar'&&d.acc!==''||d.type==='despesa'),{}).saved})()"),0);
  eq('overview counts aportes apart',run("importOverview(R.drafts).contributionTotal"),1300);
  // ---- investment statement: only money in is a contribution
  fresh();
  const inv=['Data;Descrição;Valor','03/11/2026;APORTE TESOURO SELIC 2031;2.000,00','04/11/2026;RENDIMENTO;35,10','05/11/2026;IOF;-0,50','06/11/2026;RESGATE;-100,00'].join('\n');
  run(`globalThis.R=readImportFile({name:'corretora.csv',text:${J(inv)}},{today:'2026-11-10',kind:'invest'});R`);
  eq('investment statement: aporte in, rest ignored with reasons',run("R.drafts.map(d=>[d.type,d.reason])"),[['aporte',null],['ignorar','rendimento'],['ignorar','resgate'],['ignorar','resgate']]);
  // ---- dividing one draft across categories (invented values): the parts are saved as splits, the rest
  // stays in the main category, parts bigger than the value block the import
  fresh();
  read('div.csv',['Data;Descrição;Valor','17/11/2026;PIX ENVIADO FULANO;-1.176,00'].join('\n'));
  run("globalThis.D=R.drafts[0];D.cat='Saúde';D.splits=splitAdded(D);D.splits=splitChanged(D,0,{cat:'Presente',value:750})");
  eq('the part and the rest',[run('splitParts(D)'),run('splitRest(D)')],[[{cat:'Presente',value:750}],426]);
  eq('an empty part does not count',run("splitParts({type:'despesa',value:10,splits:[{cat:'',value:5},{cat:'X',value:0}]}).length"),0);
  eq('a contribution is not divided',[run("canSplit({type:'aporte'})"),run("splitParts({type:'aporte',value:10,splits:[{cat:'X',value:5}]}).length")],[false,0]);
  eq('removing a part',run("splitRemoved({splits:[{cat:'A',value:1},{cat:'B',value:2}]},0)"),[{cat:'B',value:2}]);
  eq('parts bigger than the value: a problem that blocks the import',run("draftProblems(Object.assign({},D,{splits:[{cat:'Presente',value:1200}]}))"),['Divisão: as partes somam mais que o valor']);
  run("commitImport(R.drafts,{})");
  const saved=run("S.tx.find(t=>t.desc.indexOf('FULANO')>=0)");
  eq('saved like the manual form: main category, value, splits',[saved.cat,saved.value,saved.splits],['Saúde',1176,[{cat:'Presente',value:750}]]);
  eq('each category gets its share',run("catParts(S.tx.find(t=>t.desc.indexOf('FULANO')>=0))"),[{cat:'Presente',value:750},{cat:'Saúde',value:426}]);
  // ---- contribution to an investment account that does not exist yet: created only on confirm, once per name
  fresh();run("S.accounts=[]");
  read('apo.csv',['Data;Descrição;Valor','06/11/2026;PIX ENVIADO FULANO;-30.000,00','07/11/2026;PIX ENVIADO FULANO;-1.000,00'].join('\n'));
  run("R.drafts.forEach(d=>{d.type='aporte';d.acc=defaultAccount(d.desc);d.selected=true;})");
  eq('with no account the default choice is a new one',run("R.drafts.map(d=>d.acc)"),['__new','__new']);
  eq('without a name it cannot be imported',run("draftProblems(R.drafts[0])"),['Investimento: digite o nome da conta nova']);
  eq('the preview creates nothing',run("S.accounts.length"),0);
  run("R.drafts[0].newAcc='Itaú Invest';R.drafts[1].newAcc=' itaú invest '");
  const ca=run("commitImport(R.drafts,{})");
  eq('one account for the same name, both contributions go to it',[ca.saved,ca.accounts,run("S.accounts.map(a=>a.name)"),run("new Set(S.tx.map(t=>t.acc)).size"),run("S.tx[0].acc===S.accounts[0].id")],[2,['Itaú Invest'],['Itaú Invest'],1,true]);
  eq('an existing account with that name is reused',run("accountNamed('ITAÚ INVEST').id===S.accounts[0].id"),true);
  eq('with an account, nothing is chosen for the user',run("defaultAccount('PIX QUALQUER')"),'');
  return res;};

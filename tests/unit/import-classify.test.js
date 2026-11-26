/**
 * What a raw statement line is: dropped balance, income, expense, contribution, own transfer, or something that must not count (invoice payment, refund, redemption, yield).
 * Plus installments, the "is it a Pix/TED" hint and the automatic categories. Texts are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('import-classify');
  const J=JSON.stringify,cls=(desc,flow,kind,ctx)=>run(`classifyEntry({desc:${J(desc)}},${J(flow)},${J(kind)},${J(ctx||{})})`);
  const typeOf=(d,f,k,c)=>cls(d,f,k,c).type,reasonOf=(d,f,k,c)=>cls(d,f,k,c).reason;
  // ---- balance lines are dropped, never an entry
  for(const d of ['SALDO ANTERIOR','Saldo final do dia','TOTAL','Subtotal','SALDO DISPONIVEL'])eq('balance line dropped: '+d,cls(d,'in','bank'),{drop:true});
  eq('"saldo" inside a normal description is not a balance line',cls('COMPRA SALDAO DE LIVROS','out','bank').drop,undefined);
  ok('isBalanceLine ignores accents and case',run(`isBalanceLine('Saldo Disponível')`)===true&&run(`isBalanceLine('PADARIA')`)===false);
  // ---- plain direction
  eq('money out is an expense',typeOf('PADARIA SAMPLE','out','bank'),'despesa');
  eq('money in is an income',typeOf('EMPRESA SAMPLE DEPOSITO','in','bank'),'receita');
  // ---- invoice payment never counts (the purchases are already in the card)
  for(const d of ['PAGAMENTO FATURA CARTAO','PGTO FATURA','Pagamento recebido','PAGAMENTO ON LINE','Pagamento da fatura']){
    eq('invoice payment ignored: '+d,[typeOf(d,'out','bank'),reasonOf(d,'out','bank')],['ignorar','pagamento_fatura']);}
  // ---- investment statements: money in is a contribution, the rest is not a transaction
  eq('invest: money in is a contribution',typeOf('APORTE TESOURO','in','invest'),'aporte');
  eq('invest: money out is a redemption',[typeOf('RESGATE CDB','out','invest'),reasonOf('RESGATE CDB','out','invest')],['ignorar','resgate']);
  eq('invest: yield, tax and fees are not entries',[typeOf('RENDIMENTO','in','invest'),reasonOf('IOF','in','invest'),reasonOf('Taxa de custodia','in','invest')],['ignorar','rendimento','rendimento']);
  // ---- bank: own transfers and investment words
  eq('"transferencia entre contas" is an own transfer (bank)',typeOf('TRANSFERENCIA ENTRE CONTAS','out','bank'),'transferencia');
  eq('own-transfer words on a card are ignored as a transfer',[typeOf('TRANSFERENCIA ENTRE CONTAS','in','card'),reasonOf('TRANSFERENCIA ENTRE CONTAS','in','card')],['ignorar','transferencia']);
  eq('money in with an investment word is not income',[typeOf('RESGATE CDB SAMPLE','in','bank'),reasonOf('APLICACAO RENDA FIXA','in','bank')],['ignorar','transferencia']);
  // owner decision Q5: money in with an investment or redemption word is a possible transfer (flagged, ignored); money out stays a contribution to confirm
  const flagsOf=(d,f,k)=>cls(d,f,k).flags;
  for(const d of ['APLICACAO RENDA FIXA','RESGATE CDB SAMPLE','TESOURO DIRETO SAMPLE','CAIXINHA SAMPLE','SAQUE POUPANCA SAMPLE'])
    eq('Q5 money in is a possible transfer, flagged: '+d,[typeOf(d,'in','bank'),flagsOf(d,'in','bank')],d.includes('POUPANCA')?['transferencia',[]]:['ignorar',['possible-transfer']]);
  eq('Q5 money out with the same words is not flagged as a possible transfer (it is a contribution to confirm)',[typeOf('APLICACAO CDB SAMPLE','out','bank'),flagsOf('APLICACAO CDB SAMPLE','out','bank')],['aporte',['check-aporte']]);
  eq('Q5 an ordinary income is not flagged',[typeOf('SALARIO EMPRESA','in','bank'),flagsOf('SALARIO EMPRESA','in','bank')],['receita',[]]);
  eq('Q5 own-transfer words on a card stay ignored without the review flag',flagsOf('TRANSFERENCIA ENTRE CONTAS','in','card'),[]);
  eq('Q5 the flag has a text for the screen',run("typeof FLAG_TEXT['possible-transfer']"),'string');
  eq('money out to an investment is a contribution to confirm',[typeOf('APLICACAO CDB SAMPLE','out','bank'),cls('APLICACAO CDB SAMPLE','out','bank').flags],['aporte',['check-aporte']]);
  // ---- the holder's own name
  const ctx={ownNames:['Joana Prado Leite']};
  eq('a Pix to my own name is an own transfer',typeOf('PIX ENVIADO Joana Prado Leite','out','bank',ctx),'transferencia');
  eq('a salary in my name is still income',typeOf('TED CONTA SALARIO JOANA PRADO LEITE','in','bank',ctx),'receita');
  eq('another person with the same first name is not me',typeOf('PIX ENVIADO Joana Silva','out','bank',ctx),'despesa');
  eq('without names known, nothing is an own transfer',typeOf('PIX ENVIADO Joana Prado Leite','out','bank'),'despesa');
  // ---- refunds and card credits
  eq('a card credit is not income',[typeOf('PAGAMENTO LOJA X','in','card'),reasonOf('CREDITO LOJA','in','card')],['ignorar','estorno']);
  eq('a refund in a bank statement is ignored',[typeOf('ESTORNO COMPRA','in','bank'),reasonOf('REEMBOLSO','in','bank')],['ignorar','estorno']);
  eq('a refund word on money out is still an expense',typeOf('CANCELAMENTO PLANO','out','bank'),'despesa');
  // ---- flags and categories
  eq('Pix/TED on a bank statement asks for confirmation',cls('PIX ENVIADO FULANO','out','bank').flags,['maybe-transfer']);
  eq('Pix on a card is not flagged',cls('PIX LOJA','out','card').flags,[]);
  eq('fees get the bank-fees category',cls('TARIFA PACOTE SERVICOS','out','bank').cat,'Tarifas bancárias e juros');
  eq('salary gets the salary category',cls('SALARIO EMPRESA SAMPLE','in','bank').cat,'Salário');
  eq('an ordinary expense has no category',cls('LOJA SAMPLE','out','bank').cat,'');
  // ---- installments
  eq('PARC 03/10 is sure',run(`parseInstallment('LOJA TESTE PARC 03/10')`),{n:3,of:10,sure:true});
  eq('"parcela 3 de 10" is sure',run(`parseInstallment('Parcela 3 de 10 LOJA')`),{n:3,of:10,sure:true});
  eq('a bare 02/03 at the end is unsure',run(`parseInstallment('LOJA TESTE 02/03')`),{n:2,of:3,sure:false});
  eq('a bare date-like 12/12 in the middle is not an installment',run(`parseInstallment('12/12 LOJA')`),null);
  eq('n greater than the total is not an installment',run(`parseInstallment('LOJA PARC 05/03')`),null);
  eq('more than 60 installments is not an installment',run(`parseInstallment('LOJA PARC 01/99')`),null);
  eq('a bare 1/1 is not an installment',run(`parseInstallment('LOJA 1/1')`),null);
  eq('no text, no installment',run(`parseInstallment('')`)||run(`parseInstallment(undefined)`),null);
  eq('an unsure installment is flagged',cls('LOJA TESTE 02/03','out','card').flags,['installment-unsure']);
  eq('a sure installment is not flagged',cls('LOJA TESTE PARC 02/03','out','card').flags,[]);
  // ---- the small helpers
  eq('looksLikeTransfer',[run(`looksLikeTransfer('PIX ENVIADO')`),run(`looksLikeTransfer('Transferência recebida')`),run(`looksLikeTransfer('PADARIA')`),run(`looksLikeTransfer('TEDDY SHOP')`)],[true,true,false,false]);
  eq('every ignore reason has a text for the screen',run(`Object.values(IGNORE_REASON).every(r=>!!REASON_TEXT[r])`),true);
  eq('every flag the classifier can raise has a text',run(`['maybe-transfer','installment-unsure','check-aporte'].every(f=>!!FLAG_TEXT[f])`),true);
  // ---- boundaries of the unsure form "n/of" at the end of the text: 1 <= n <= of, 2 <= of <= 24
  const inst=t=>run(`parseInstallment(${J(t)})`);
  eq('1/2 is the smallest installment',inst('LOJA 1/2'),{n:1,of:2,sure:false});
  eq('n equal to the total is the last installment',inst('LOJA 2/2'),{n:2,of:2,sure:false});
  eq('24/24 is accepted',inst('LOJA 24/24'),{n:24,of:24,sure:false});
  eq('a total above 24 is read as a date, not as installments',inst('LOJA 1/25'),null);
  eq('n = 0 is not an installment',inst('LOJA 0/5'),null);
  eq('n above the total is not an installment',inst('LOJA 3/2'),null);
  eq('a total of 1 is not an installment',inst('LOJA 1/1'),null);
  return res;};

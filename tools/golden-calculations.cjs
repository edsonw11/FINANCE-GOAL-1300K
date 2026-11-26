/**
 * tools/golden-calculations.cjs
 * Responsibility: the numeric baseline of the financial rules. Builds ONE invented state (no real data), freezes the
 * clock, runs the main rules and prints their results as JSON. The output is committed as
 * docs/architecture/baseline/golden-calculations.json; tests/unit/golden.test.js recomputes it and fails when a
 * rule changes, so no financial rule changes silently (also the acceptance data for any future port of the rules).
 * Usage: node tools/golden-calculations.cjs > docs/architecture/baseline/golden-calculations.json
 */
const {createContext}=require('../tests/unit/harness');
const FROZEN='2026-11-20T12:00:00';
function setup(){
  const {ctx,run}=createContext();
  // the clock stands still: every "today" in the rules is 2026-11-20
  ctx.Date=class extends Date{constructor(...a){a.length?super(...a):super(FROZEN);}static now(){return new Date(FROZEN).getTime();}};
  const J=JSON.stringify,tx=(id,type,date,value,cat,extra)=>J({id,type,date,value,cat,desc:cat+' '+id,fonte:'caixa',...extra});
  const rows=[
    tx(1,'receita','2026-09-05',8000,'Salário'),tx(2,'despesa','2026-09-06',2000,'Aluguel'),tx(3,'despesa','2026-09-10',700.55,'Mercado'),
    tx(4,'despesa','2026-09-20',150,'Uber e transporte por app',{fonte:'cartao'}),tx(5,'aporte','2026-09-12',1500,'x',{acc:'a1'}),
    tx(6,'receita','2026-10-05',8200,'Salário'),tx(7,'despesa','2026-10-06',2000,'Aluguel'),tx(8,'despesa','2026-10-09',812.4,'Mercado'),
    tx(9,'despesa','2026-10-14',99.9,'Lazer',{fonte:'cartao'}),tx(10,'despesa','2026-10-24',300,'Restaurantes',{fonte:'cartao'}),
    tx(11,'despesa','2026-10-26',450.1,'Saúde',{fonte:'cartao',splits:[{cat:'Farmácia',value:120.1}]}),tx(12,'aporte','2026-10-12',2000,'x',{acc:'a2'}),
    tx(13,'fatura','2026-11-05',500,'Cartão de crédito',{fm:'2026-11'}),tx(14,'receita','2026-11-05',8200,'Salário'),
    tx(15,'despesa','2026-11-06',2000,'Aluguel'),tx(16,'despesa','2026-11-09',640.2,'Mercado'),tx(17,'despesa','2026-11-15',89.9,'Lazer',{fonte:'cartao'}),
    tx(18,'aporte','2026-11-10',1800,'x',{acc:'a1'}),tx(19,'despesa','2026-08-06',2000,'Aluguel'),tx(20,'receita','2026-08-05',7900,'Salário')].join(',');
  run(`S=blankState();S.goal=100000;S.rate=10;S.planned=1500;S.card={best:25,due:5,biz:true,over:{},v3:true};
    S.accounts=[{id:'a1',name:'CDB Teste'},{id:'a2',name:'Tesouro Teste'}];
    S.snaps=[{date:'2026-08-31',acc:'a1',value:10000},{date:'2026-08-31',acc:'a2',value:20000},
             {date:'2026-09-30',acc:'a1',value:11700},{date:'2026-09-30',acc:'a2',value:20150},
             {date:'2026-10-31',acc:'a1',value:11900,gross:11950},{date:'2026-10-31',acc:'a2',value:22400}];
    S.cats=undefined;delete S.catsV2;delete S.catsV3;delete S.catsV4;initCats();S.budgets={Alimentação:1000,Moradia:2100};S.nid=100;S.tx=[${rows}]`);
  return {ctx,run};
}
/**
 * compute(run): every result of the baseline, from expressions evaluated by `run` against a state that is already loaded.
 * The browser rules run it in a vm (golden()); the server runs the same expressions on the shared modules (backend integration test).
 */
function compute(run){
  const J=JSON.stringify;
  const out={frozenAt:FROZEN};
  const ms=['2026-08','2026-09','2026-10','2026-11'];
  out.money={float:[run('roundMoney(0.1+0.2)'),run('sumMoney([0.1,0.2,0.3])'),run('toCents(19.99)')],parse:['R$ 1.234,56','1500','1.500,5','12.3'].map(s=>run(`parseMoney(${J(s)})`))};
  out.months=ms.map(m=>run(`(s=>({m:'${m}',income:s.income.total,expenses:s.expenses.total,contributions:s.contributions.total,cashTotal:s.cash.total,
    cardBought:s.cardBought,invoicesPaid:s.invoicesPaid,openCard:s.openCard.total,undetailed:s.expenses.undetailed.map(u=>u.value)}))(monthSummary('${m}'))`));
  out.monthResult=ms.map(m=>run(`Object.assign({m:'${m}'},monthResult('${m}'))`));
  out.categories=['2026-09','2026-10','2026-11'].map(m=>({m,cats:run(`catMonth('${m}')`),groups:run(`groupMonth('${m}')`)}));
  out.budgets=run("budgetStatus('2026-10','2026-10-31')");
  out.card={best:25,due:5,
    dueMonthOf:['2026-10-24','2026-10-25','2026-10-26','2026-11-15','2026-11-30','2026-12-31'].map(d=>[d,run(`dueMonth('${d}')`)]),
    cycle:['2026-11','2026-12','2027-01'].map(fm=>({fm,close:run(`closeDateOf('${fm}')`),due:run(`dueDateOf('${fm}')`),totals:run(`cycleTotals('${fm}')`)})),
    payable:run('payableInvoices()')};
  out.investments={net:ms.map(m=>[m,run(`total(asOf('${m}'))`)]),real:run('realSeries()').map(r=>({m:r.m,t:r.t,ap:r.ap,y:r.y})),
    project:(p=>({hit:p.hit,first:p.proj.slice(0,3),last:p.proj[p.proj.length-1]}))(run('project(realSeries())')),
    distribution:run("investmentDistribution('2026-11-20','account')")};
  out.reserve=run("emergencyFund('2026-11-20')");
  out.todo=run("nextActions('2026-11-20').map(a=>[a.code,a.data])");
  out.trend=[run('linearTrend([0,1,2,3],[100,110,125,131])'),run('linearTrend([0,1,2],[5,5,5])')];
  out.quickEntry=['Gastei 85,90 no mercado hoje','recebi 5000 de salário','paguei 120 de luz ontem'].map(s=>run(`parseQuickEntry(${J(s)},'2026-11-20')`));
  // import: a small CSV through the real reader and the classifier (types and signs, no screen)
  const csv=['Data;Descrição;Valor','03/11/2026;SALDO ANTERIOR;1.000,00','04/11/2026;PADARIA TESTE;-13,37','05/11/2026;EMPRESA TESTE SA SALARIO;4.321,09','06/11/2026;PAGAMENTO FATURA CARTAO;-900,00','07/11/2026;LOJA TESTE PARC 02/03;-77,77'].join('\n');
  out.importCsv=run(`readImportFile({name:'x.csv',text:${J(csv)}},{today:'2026-11-20'}).drafts.map(d=>[d.date,d.desc,d.value,d.type,d.reason,d.flags,d.installment])`);
  // import: text of a PDF statement (Nubank-like groups, invented) through the PDF reader
  const pdf=['Movimentações','02 NOV 2026 Total de entradas + 1.000,00','Transferência recebida pelo Pix FULANO 1.000,00','Total de saídas - 80,00','Pagamento de boleto efetuado LOJA X 80,00'].join('\n');
  out.importPdf=run(`pdfEntries(${J(pdf)},{today:'2026-11-20'}).entries.map(e=>[e.date,e.desc,e.amount,e.flags])`);
  out.report=run("buildReport('2026-10','2026-11-20')");
  return out;
}
if(require.main===module)process.stdout.write(JSON.stringify(golden(),null,1)+'\n');
function golden(){const {run}=setup();return compute(run);}
/** The invented state the baseline starts from (what the server must be able to import, store and rebuild). */
function goldenState(){const {run}=setup();return JSON.parse(run('JSON.stringify(S)'));}
module.exports={golden,compute,goldenState,FROZEN};

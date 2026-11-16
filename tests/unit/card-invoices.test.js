/** Invoice allocation, status of each invoice and the payment plan (card-invoices, card-status, invoice-payment). */
const {createContext,suite}=require('./harness');
const fx=`S=seed();S.tx=[];var _id=1;var add=o=>{const t=Object.assign({id:_id++},o);S.tx.push(t);S.nid=_id;return t;};
add({type:'despesa',date:'2026-10-02',value:100,cat:'Mercado',fonte:'cartao'});
add({type:'despesa',date:'2026-10-10',value:50,cat:'Lazer',fonte:'cartao'});
add({type:'despesa',date:'2026-10-20',value:30,cat:'Saúde',fonte:'cartao'});_al=null;`;
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('card invoices');
  run(fx);
  // allocation: an invoice absorbs purchases of its cycle, oldest first, up to its value
  run("add({type:'fatura',date:'2026-11-07',value:150,cat:'Fatura do cartão',fm:'2026-11'});_al=null;");
  eq('alloc oldest first up to value',run("invoiceItems(S.tx[3]).map(t=>t.id)"),[1,2]);
  eq('undetailed when items fill it',run("invoiceUndetailed(S.tx[3])"),0);
  eq('open card keeps the rest',run("openCard(null).map(t=>t.id)"),[3]);
  run("S.tx[3].items=[3];_al=null;");
  eq('manual items replace automatic',run("invoiceItems(S.tx[3]).map(t=>t.id)"),[3]);
  eq('undetailed = value - items',run("invoiceUndetailed(S.tx[3])"),120);
  run("S.tx.pop();_al=null;");
  // status
  eq('open before closing',run("invoiceStatus('2026-11','2026-10-25')"),{code:'open',days:3});
  eq('closed before due',run("invoiceStatus('2026-11','2026-11-02')"),{code:'closed',days:5});
  eq('late after due without payment',run("invoiceStatus('2026-11','2026-11-10')"),{code:'late',days:0});
  eq('cycle totals',run("cycleTotals('2026-11')"),{bought:180,paid:0});
  // payment plan
  eq('full payment',run("planPayment('2026-11',[1,2,3],'total',0)"),{value:180,full:true,remaining:0,items:null});
  eq('only checked purchases',run("planPayment('2026-11',[1,3],'total',0)"),{value:130,full:false,remaining:50,items:[1,3]});
  eq('partial value',run("planPayment('2026-11',[1,2,3],'part',40)"),{value:40,full:false,remaining:140,items:null});
  eq('partial needs a value',run("planPayment('2026-11',[1,2,3],'part',0)"),{error:'Digite o valor que vai pagar'});
  eq('nothing checked',run("planPayment('2026-11',[],'total',0)"),{error:'Marque pelo menos uma compra'});
  const id=run("transact(()=>payInvoice('2026-11',planPayment('2026-11',[1,2,3],'part',40),'2026-11-05'))");
  ok('payment created',run(`S.tx.some(t=>t.type==='fatura'&&t.value===40&&t.fm==='2026-11'&&t.date==='2026-11-05')`));
  eq('status paid',run("invoiceStatus('2026-11','2026-11-10').code"),'paid');
  // classify the undetailed part of a paid invoice
  run("S.tx=S.tx.filter(t=>t.type!=='fatura');add({type:'fatura',date:'2026-11-07',value:200,cat:'Fatura do cartão',fm:'2026-11'});_al=null;");
  const inv=run("S.tx[S.tx.length-1].id");
  eq('classify above undetailed refused',run(`classifyUndetailed(${inv},{cat:'Uber',desc:'',value:50})`),{error:'O valor deve ser maior que zero e até R$ 20,00'});
  eq('classify needs category',run(`classifyUndetailed(${inv},{cat:'',desc:'',value:5})`),{error:'Informe a categoria'});
  ok('classify ok',run(`classifyUndetailed(${inv},{cat:'Uber',desc:'corrida',value:20}).id>0`));
  eq('nothing left undetailed',run(`(_al=null,invoiceUndetailed(S.tx.find(t=>t.id===${inv})))`),0);
  return res;};

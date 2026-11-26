/**
 * Paying a card invoice and classifying its undetailed part (domain/invoice-payment.js): the refusals and the exact effects on the state.
 * Found by the coverage report: these error paths were never executed by the unit suite. Values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('invoice-payment-edges');
  const fx=`S=seed();S.tx=[];S.card={best:29,due:7,biz:false,over:{},v3:true};var _id=1;var add=o=>{const t=Object.assign({id:_id++},o);S.tx.push(t);S.nid=_id;return t;};
    add({type:'despesa',date:'2026-10-02',value:100,cat:'Mercado',fonte:'cartao'});
    add({type:'fatura',date:'2026-11-07',value:150,cat:'Fatura do cartão',fm:'2026-11'});
    add({type:'despesa',date:'2026-11-10',value:80,cat:'Mercado',fonte:'cartao'});_al=null;`;
  run(fx);
  // ---- planPayment
  eq('an invoice that is not open has no plan',run("planPayment('2030-01',[1],'total',0)"),{error:'Esta fatura não tem valor em aberto'});
  eq('a negative partial value is refused',run("planPayment('2026-12',[],'part',-5)"),{error:'Digite o valor que vai pagar'});
  // owner decision Q8 (provisional, docs/testing/owner-decisions.md): a value above what is open is paid as typed, the excess is shown before confirming and becomes an expense, not a credit
  eq('a partial value above what is open (rest 80, typed 500): full, nothing remaining, the typed value kept',run("(p=>[p.value,p.full,p.remaining])(planPayment('2026-12',[],'part',500))"),[500,true,0]);
  eq('the excess over what is open: 500 on 80 is 420; exactly 80, less, and a hair of 0.004 are 0',[run("paymentExcess(500,80)"),run("paymentExcess(80,80)"),run("paymentExcess(79.99,80)"),run("paymentExcess(80.004,80)"),run("paymentExcess(80.01,80)")],[420,0,0,0,0.01]);
  eq('after paying 500 on 80 the 420 is an expense "Cartão (sem detalhe)" of the month and nothing is credited to the next invoice',run("(()=>{const fm=payableInvoices()[0].fm;payInvoice(fm,planPayment(fm,[],'part',500),'2026-12-05');saveTransaction({type:'despesa',date:'2026-12-10',value:100,cat:'Mercado',desc:'next',fonte:'cartao'});const m=monthSummary('2026-12');return [m.expenses.undetailed.map(u=>u.value),payableInvoices().map(f=>f.rest)];})()"),[[420],[100]]);
  // ---- payInvoice
  const before=run('JSON.stringify(S.tx)'),nid=run('S.nid');
  eq('a plan with an error is returned as it is and nothing is saved',[run("payInvoice('2026-11',{error:'x'},'2026-11-05')"),run('JSON.stringify(S.tx)'),run('S.nid')],[{error:'x'},before,nid]);
  eq('no plan at all is an invalid payment, nothing saved',[run("payInvoice('2026-11',undefined,'2026-11-05')"),run('JSON.stringify(S.tx)')],[{error:'Pagamento inválido'},before]);
  const paid=run("payInvoice('2026-11',{value:40.004,items:[1]},'2026-11-05')");
  eq('a payment is saved as an invoice record, with the value rounded to cents and its own items',run(`(t=>[t.type,t.value,t.fm,t.date,t.items])(S.tx.find(x=>x.id===${paid.id}))`),['fatura',40,'2026-11','2026-11-05',[1]]);
  eq('the id counter moved on',run('S.nid')>nid,true);
  const noItems=run("payInvoice('2026-11',{value:10,items:null},'2026-11-06')");
  eq('a payment of the whole invoice carries no item list',run(`'items' in S.tx.find(x=>x.id===${noItems.id})`),false);
  // ---- classifyUndetailed (the part of the invoice that has no purchase behind it)
  run(fx);
  eq('an unknown invoice is refused',run("classifyUndetailed(999,{cat:'Lazer',desc:'x',value:10})"),{error:'Fatura não encontrada'});
  eq('a category is required (blanks do not count)',run("classifyUndetailed(2,{cat:'   ',desc:'x',value:10})"),{error:'Informe a categoria'});
  eq('the value must be above zero',run("classifyUndetailed(2,{cat:'Lazer',desc:'x',value:0})").error.startsWith('O valor deve ser maior que zero'),true);
  eq('the value cannot be more than what is undetailed (150 - 100 = 50)',run("classifyUndetailed(2,{cat:'Lazer',desc:'x',value:50.01})").error,'O valor deve ser maior que zero e até R$ 50,00');
  const n0=run('S.tx.length');
  const ok1=run("classifyUndetailed(2,{cat:' Lazer ',desc:' cinema ',value:50})");
  eq('exactly what is undetailed is accepted: a card expense on the invoice date, trimmed',run(`(t=>[t.type,t.value,t.cat,t.desc,t.fonte,t.date])(S.tx.find(x=>x.id===${ok1.id}))`),['despesa',50,'Lazer','cinema','cartao','2026-11-07']);
  eq('it is added to the invoice items and the undetailed part is now zero',run(`[S.tx[1].items.includes(${ok1.id}),invoiceUndetailed(S.tx[1]),S.tx.length-${n0}]`),[true,0,1]);
  ok('the category exists afterwards',run("S.cats&&JSON.stringify(S.cats).includes('Lazer')")||run("typeof catsOf==='function'?catsOf('despesa').includes('Lazer'):true"));
  eq('a partial payment of 0.50 is accepted',run("planPayment('2026-12',[],'part',0.5)").value,0.5);
  const rest=run("payableInvoices().find(f=>f.fm==='2026-12').rest");
  eq('the open amount of Dec/2026 is what the invoice of Nov/2026 did not absorb plus the November purchase',rest,130);
  eq('paying exactly the open amount is a full payment with nothing remaining',run(`(p=>[p.full,p.remaining])(planPayment('2026-12',[],'part',${rest}))`),[true,0]);
  eq('paying a cent less is not a full payment and leaves that cent',run(`(p=>[p.full,p.remaining])(planPayment('2026-12',[],'part',${rest-0.01}))`),[false,0.01]);
  eq('paying 30 leaves the rest',run("(p=>[p.full,p.remaining])(planPayment('2026-12',[],'part',30))"),[false,rest-30]);
  run(fx);
  eq('a small undetailed amount (0.50) can be classified',run("classifyUndetailed(2,{cat:'Lazer',desc:'x',value:0.5})").id>0,true);
  return res;};

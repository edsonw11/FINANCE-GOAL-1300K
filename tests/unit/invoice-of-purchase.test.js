/**
 * Which paid invoice absorbs a card purchase (domain/transactions.js invoiceOfPurchase), with the automatic allocation (oldest first, up to the invoice amount)
 * and with a manual choice of purchases (the invoice's items).
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('invoice-of-purchase');
  const J=JSON.stringify;
  const buy=(id,date,value)=>({id,type:'despesa',fonte:'cartao',date,value,cat:'Mercado'});
  const setup=(tx)=>run(`S=seed();S.card={best:29,due:7,biz:true,over:{},v3:true};S.tx=${J(tx)};invalidateAllocation();true`);
  const of=id=>run(`(()=>{const inv=invoiceOfPurchase(S.tx.find(t=>t.id===${id}));return inv?inv.id:null;})()`);
  // purchases of 10-14 Oct belong to the invoice due in Nov (closing Wed 28 Oct)
  const inv=(o)=>Object.assign({id:3,type:'fatura',fm:'2026-11',date:'2026-11-07',value:150},o);
  setup([buy(1,'2026-10-10',100),buy(2,'2026-10-12',50),inv()]);
  eq('the two purchases that add up to the invoice are absorbed by it',[of(1),of(2)],[3,3]);
  setup([buy(1,'2026-10-10',100),buy(2,'2026-10-12',50),buy(4,'2026-10-15',999),inv()]);
  eq('a purchase that does not fit in the invoice amount stays open',[of(1),of(2),of(4)],[3,3,null]);
  setup([buy(2,'2026-10-12',50),buy(1,'2026-10-10',100),inv({value:120})]);
  eq('oldest first: the 10 Oct purchase is taken, the 12 Oct one no longer fits',[of(1),of(2)],[3,null]);
  setup([buy(1,'2026-10-10',100),buy(5,'2026-10-29',40),inv({value:200})]);
  eq('a purchase after the closing belongs to the next invoice, so this one does not absorb it',[of(1),of(5)],[3,null]);
  setup([buy(1,'2026-10-10',100),buy(2,'2026-10-12',50),inv({items:[2]})]);
  eq('a manual choice replaces the automatic one',[of(1),of(2)],[null,3]);
  setup([buy(1,'2026-10-10',100)]);
  eq('a purchase with no invoice at all is open',of(1),null);
  setup([buy(1,'2026-10-10',100),inv({value:100}),inv({id:6,value:100,date:'2026-11-08'})]);
  eq('two invoices of the same month: the purchase goes to the first one only',of(1),3);
  return res;};

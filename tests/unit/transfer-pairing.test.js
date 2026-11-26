/**
 * markTransferPairs (domain/transfers.js), decision by decision: which drafts are looked at, which direction they have, which amounts can pair.
 * Added after the second mutation round showed these decisions were not checked. Values and descriptions are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('transfer-pairing');
  const J=JSON.stringify;
  const tr=o=>({id:'tr1',key:'',date:'2026-11-06',value:100,dir:'out',desc:'PIX ENVIADO',pair:null,...o});
  const dr=o=>({type:'receita',date:'2026-11-07',value:100,desc:'PIX RECEBIDO',key:null,flags:[],selected:true,cat:'Outros',...o});
  const mark=(transfers,draft)=>run(`(()=>{S=seed();S.tx=[];S.ownNames=[];S.transfers=${J(transfers)};const D=[${J(draft)}];markTransferPairs(D);return D[0];})()`);
  const paired=d=>d.pair?d.pair.kind:null;
  eq('an income draft without a flow is money coming in: it pairs with an outgoing transfer',paired(mark([tr({dir:'out'})],dr({type:'receita'}))),'transfer');
  eq('an expense draft without a flow is money going out: it pairs with an incoming transfer',paired(mark([tr({dir:'in'})],dr({type:'despesa'}))),'transfer');
  eq('an income draft does not pair with an incoming transfer (same direction)',paired(mark([tr({dir:'in'})],dr({type:'receita'}))),null);
  eq('an expense draft does not pair with an outgoing transfer (same direction)',paired(mark([tr({dir:'out'})],dr({type:'despesa'}))),null);
  eq('the flow given by the reader wins over the type',paired(mark([tr({dir:'in'})],dr({type:'receita',flow:'out'}))),'transfer');
  eq('a pair turns the draft into an own transfer that is not selected',(d=>[d.type,d.selected,d.cat])(mark([tr()],dr())),['transferencia',false,'']);
  eq('small amounts pair too (0.50)',paired(mark([tr({value:0.5})],dr({value:0.5}))),'transfer');
  eq('a zero amount never pairs, even with a zero transfer',paired(mark([tr({value:0})],dr({value:0}))),null);
  eq('a negative amount never pairs',paired(mark([tr({value:-100})],dr({value:-100}))),null);
  eq('an ignored draft is left alone',(d=>[paired(d),d.type])(mark([tr({dir:'in'})],dr({type:'ignorar'}))),[null,'ignorar']);
  eq('a contribution draft is left alone',(d=>[paired(d),d.type])(mark([tr({dir:'in'})],dr({type:'aporte'}))),[null,'aporte']);
  eq('a draft without a date is left alone and does not throw',paired(mark([tr()],dr({date:''}))),null);
  eq('more than 3 days apart does not pair; exactly 3 does',[paired(mark([tr({date:'2026-11-03'})],dr({date:'2026-11-07'}))),paired(mark([tr({date:'2026-11-04'})],dr({date:'2026-11-07'})))],[null,'transfer']);
  eq('the same key already kept is a confirmed duplicate and is not selected',(d=>[d.dup&&d.dup.level,d.selected])(mark([tr({key:'K1'})],dr({key:'K1'}))),['confirmed',false]);
  // ---- a saved record is offered as the other side only when it looks like a transfer
  const withTx=(tx,draft)=>run(`(()=>{S=seed();S.tx=${J(tx)};S.ownNames=[];S.transfers=[];const D=[${J(draft)}];markTransferPairs(D);return D[0];})()`);
  const rec=o=>({id:7,type:'despesa',fonte:'caixa',date:'2026-11-06',value:100,desc:'PIX ENVIADO MARIA',cat:'Outros',...o});
  eq('a saved bank expense that looks like a transfer is the other side of an income',paired(withTx([rec()],dr({type:'receita'}))),'record');
  eq('a saved bank expense with an ordinary description is NOT offered, even with the same value and date',paired(withTx([rec({desc:'PADARIA SAMPLE'})],dr({type:'receita'}))),null);
  eq('a card purchase is not offered',paired(withTx([rec({fonte:'cartao'})],dr({type:'receita'}))),null);
  eq('a record of a series is not offered',paired(withTx([rec({serie:'s1'})],dr({type:'receita'}))),null);
  eq('a record of the same direction is not offered',paired(withTx([rec({type:'receita'})],dr({type:'receita'}))),null);
  // ---- turning a saved record into a transfer keeps the bank key of the line
  run("S=seed();S.tx=[{id:7,type:'despesa',fonte:'caixa',date:'2026-11-06',value:100,desc:'PIX X',cat:'Outros',imp:'KEY1'},{id:8,type:'receita',fonte:'caixa',date:'2026-11-06',value:50,desc:'',cat:'Outros'}];S.transfers=[];true");
  eq('recordToTransfer keeps the import key, the direction and removes the record',run("(r=>[r.transfer.key,r.transfer.dir,S.tx.some(t=>t.id===7)])(recordToTransfer(7))"),['KEY1','out',false]);
  eq('without a key the transfer key is empty; the description falls back to the category',run("(r=>[r.transfer.key,r.transfer.dir,r.transfer.desc])(recordToTransfer(8))"),['','in','Outros']);
  eq('an unknown record is refused',run("recordToTransfer(999)").error,'Lançamento não encontrado');
  eq('an expense draft is the other side of a saved income that looks like a transfer',paired(withTx([rec({type:'receita',desc:'PIX RECEBIDO MARIA'})],dr({type:'despesa'}))),'record');
  eq('an expense draft is not the other side of a saved expense',paired(withTx([rec({type:'despesa'})],dr({type:'despesa'}))),null);
  // which own-transfer drafts are kept: a date and a value above zero (0.5 and 1 count; 0 does not)
  const keep=v=>run(`(()=>{S=seed();S.tx=[];S.ownNames=[];S.transfers=[];const r=keepTransfers([{type:IMPORT_TYPE.ownTransfer,date:'2026-11-06',value:${v},desc:'x',key:'k${v}',pair:null,type2:0}].map(d=>({...d,type:IMPORT_TYPE.ownTransfer})));return r.kept;})()`);
  eq('keepTransfers keeps a value of 0.5 and of 1, and refuses 0',[keep(0.5),keep(1),keep(0)],[1,1,0]);
  return res;};

/**
 * domain/trade-commit.js
 * Responsibility: the only place where reviewed trades of a brokerage note are saved. Each trade goes to
 * S.trades with a key (the same note imported twice saves nothing twice). Each BUY also becomes an "aporte"
 * in the account of its kind of asset (created when missing), so the monthly summary and the goal keep
 * working; a SELL is only recorded (the balance is corrected by the custody statement).
 * commitTrades(trades, {date}) -> {saved, skipped, bought}
 */
import { S } from './store.js';
import { roundMoney } from '../core/money.js';
import { textHash } from '../core/text-normalize.js';
import { saveTransaction } from './transaction-builder.js';
import { ASSET_LABEL } from './ticker-class.js';
import { accName } from './accounts.js';
const fmt=n=>String(n).replace('.',',');
function accountForClass(cls){
  const name=ASSET_LABEL[cls]||'Ações';
  const found=S.accounts.find(a=>!a.archived&&accName(a.id)===name);
  if(found)return found.id;
  const id='a'+(S.nid++);S.accounts.push({id,name});return id;
}
export const tradeKey=(date,t,n)=>'trade:'+textHash([date,t.side,t.ticker,t.qty,t.price].join('|'))+'#'+n;
// what is wrong with a trade that makes it impossible to save; [] = ok
export function tradeProblems(t){
  const p=[];
  if(!/^[A-Z]{4}\d{1,2}$/.test(String(t.ticker||'').toUpperCase()))p.push('Código do ativo (ex.: PETR4)');
  if(!(t.qty>0)||!(t.price>0))p.push('Quantidade ou preço inválido');
  return p;
}
export function commitTrades(trades,meta){
  const date=meta.date;
  if(!date)return {error:'Data da nota inválida'};
  const bad=trades.find(t=>tradeProblems(t).length);
  if(bad)return {error:'Corrija: '+tradeProblems(bad)[0]};
  S.trades=S.trades||[];
  const taken=new Set(S.trades.map(t=>t.key)),seen={};let saved=0,skipped=0,bought=0;
  trades.forEach(t=>{
    const base=tradeKey(date,t,0).split('#')[0];seen[base]=(seen[base]||0)+1;
    const key=base+'#'+seen[base];
    if(taken.has(key)){skipped++;return;}
    const ticker=t.ticker.toUpperCase();
    S.trades.push({id:'t'+(S.nid++),key,date,ticker,cls:t.cls,name:t.name||'',side:t.side,qty:t.qty,price:t.price,fees:roundMoney(t.fees||0)});
    if(t.side==='C'){
      const r=saveTransaction({editId:null,type:'aporte',value:roundMoney(t.qty*t.price+(t.fees||0)),date,cat:'',fonte:'caixa',acc:accountForClass(t.cls),
        desc:'Compra '+ticker+' '+fmt(t.qty)+' × '+String(t.price).replace('.',','),splits:[],repeat:1});
      if(r&&r.error)throw new Error(r.error);
      r.ids.forEach(id=>{const x=S.tx.find(y=>y.id===id);if(x)x.imp=key;});bought++;
    }
    taken.add(key);saved++;
  });
  return {saved,skipped,bought};
}

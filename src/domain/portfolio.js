/**
 * domain/portfolio.js
 * Responsibility: the portfolio as a person reads it. From the list of trades (S.trades) it computes, per
 * ticker, the quantity, the average cost (costs included) and the amount invested, plus the result of
 * what was sold; and groups the tickers by kind of asset. Average-cost method. Pure calculation.
 */
import { S } from './store.js';
import { roundMoney, sumMoney } from '../core/money.js';
import { ASSET_ORDER } from './ticker-class.js';
export const tradesOf=()=>S.trades||[];
const sortTrades=ts=>ts.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.id<b.id?-1:1);
// -> [{ticker, cls, name, qty, avg, cost, realized, oversold}] (everything ever traded, open or closed)
export function positions(trades){
  const by={};
  sortTrades(trades||tradesOf()).forEach(t=>{
    const p=by[t.ticker]||(by[t.ticker]={ticker:t.ticker,cls:t.cls,name:t.name||'',qty:0,cost:0,realized:0,oversold:false});
    p.cls=t.cls;
    if(t.side==='C'){p.qty+=t.qty;p.cost+=t.qty*t.price+t.fees;}
    else{
      const avg=p.qty>0?p.cost/p.qty:0,sold=Math.min(t.qty,p.qty);
      if(t.qty>p.qty)p.oversold=true; // sold more than the notes imported so far show: an older note is missing
      p.realized+=(t.qty*t.price-t.fees)-avg*sold;p.cost-=avg*sold;p.qty-=sold;
      if(p.qty<=1e-9){p.qty=0;p.cost=0;}
    }
  });
  return Object.values(by).map(p=>({...p,cost:roundMoney(p.cost),realized:roundMoney(p.realized),avg:p.qty>0?roundMoney(p.cost/p.qty):0}));
}
// open positions grouped by class, with the share of each group: [{cls, items, cost, share}]
export function portfolioGroups(trades){
  const open=positions(trades).filter(p=>p.qty>0),total=sumMoney(open.map(p=>p.cost));
  return ASSET_ORDER.map(cls=>{
    const items=open.filter(p=>p.cls===cls).sort((a,b)=>b.cost-a.cost),cost=sumMoney(items.map(p=>p.cost));
    return {cls,items,cost,share:total?cost/total:0};
  }).filter(g=>g.items.length);
}
export const realizedTotal=trades=>sumMoney(positions(trades).map(p=>p.realized));

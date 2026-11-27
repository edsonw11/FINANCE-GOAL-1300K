/**
 * domain/demo-extras.js
 * Responsibility: the rest of the test data, so that every screen has something to show: salary and extra
 * income, contributions (aportes), card purchases, and a small portfolio (trades of stocks, FIIs and ETFs with
 * the contribution each buy creates). Everything is marked demo:true, so removeDemoData() takes it all away.
 * Deterministic: the same call always creates the same records.
 */
import { t } from '../core/i18n.js';
import { decimalSeparator } from '../core/locale-format.js';
import { mIdx, mKey, mOf, today } from '../core/dates.js';
import { S } from './store.js';
import { ensureCat } from './categories.js';
import { ASSET_LABEL } from './ticker-class.js';
export const DEMO_MONTHS=12;
// the last 12 months, ending in the current one (so the screen the user opens first has data)
export const demoMonths=()=>{const end=mIdx(mOf(today()));return Array.from({length:DEMO_MONTHS},(_,k)=>mKey(end-(DEMO_MONTHS-1)+k));};
// a day of that month, never later than today (no records in the future)
export const demoDate=(month,day)=>{const t=today(),d=month+'-'+String(day).padStart(2,'0');return d>t?t:d;};
// [month offset from the first month, ticker, class, side, qty, price]
/** @type {[number, string, string, string, number, number][]} */
const DEMO_TRADES=[[0,'PETR4','acao','C',100,36.4],[1,'HGLG11','fii','C',20,155.2],[2,'IVVB11','etf','C',10,298.5],[3,'VALE3','acao','C',40,62.1],
  [4,'HGLG11','fii','C',15,157.9],[5,'PETR4','acao','C',60,37.8],[6,'IVVB11','etf','C',8,305.3],[8,'VALE3','acao','V',15,64.7],[9,'XPLG11','fii','C',30,98.4],[10,'BOVA11','etf','C',12,128.6],[11,'HGLG11','fii','C',10,161.3],[11,'ITSA4','acao','C',200,10.2]];
const demoAccountFor=cls=>{
  const name=ASSET_LABEL[cls],found=S.accounts.find(a=>!a.archived&&a.name===name);
  if(found)return found.id;
  const id='a'+(S.nid++);S.accounts.push({id,name,demo:true});return id;
};
// investment accounts with made-up balances that grow every month, so the Investments screen and the chart are full
/** @type {[string, number, number, number][]} */
const demoAccounts=()=>[[t('demo.accFixedIncome'),18000,0.009,1500],[t('demo.accTreasury'),30000,0.010,0],[t('demo.accCdb'),9000,0.0085,300],[t('demo.accEmergency'),12000,0.008,0]];
function addDemoAccounts(months){
  const ids=demoAccounts().map(([name,v0,rate,aporte])=>{
    const id='a'+(S.nid++);S.accounts.push({id,name,demo:true});
    let v=v0;months.forEach((m,k)=>{
      const date=demoDate(m,28),gross=Math.round(v*1.03*100)/100;
      S.snaps.push({date,acc:id,value:Math.round(v*100)/100,est:false,gross});
      v=v*(1+rate)+aporte;});
    return id;});
  return {ids};
}
const put=(t)=>{S.tx.push({id:S.nid++,demo:true,...t});};
export function addDemoExtras(){
  const months=demoMonths(),accs=addDemoAccounts(months);
  ensureCat('receita','Salário');ensureCat('receita','Outros');ensureCat('despesa','Mercado');ensureCat('despesa','Lazer');
  months.forEach((m,k)=>{
    put({type:'receita',date:demoDate(m,5),value:6500+k*40,desc:t('demo.salary'),cat:'Salário',fonte:'caixa'});
    if(k%4===2)put({type:'receita',date:demoDate(m,20),value:850,desc:t('demo.extraIncome'),cat:'Outros',fonte:'caixa'});
    // the monthly aporte of each account is also a record, so the yield of the month is only the growth
    demoAccounts().forEach(([name,,,aporte],i)=>{if(aporte>0)put({type:'aporte',date:demoDate(m,6),value:aporte,desc:t('demo.monthlyContribution'),acc:accs.ids[i]});});
    [['Mercado',t('demo.cardPurchase'),240+k*6,9],['Lazer',t('demo.cinema'),180+k*5,17]].forEach(([cat,desc,v,day])=>
      put({type:'despesa',date:demoDate(m,day),value:v,desc,cat,fonte:'cartao'}));
  });
  DEMO_TRADES.forEach(([k,ticker,cls,side,qty,price],i)=>{
    const date=demoDate(months[k],12),fees=Math.round(qty*price*0.0005*100)/100+1;
    S.trades=S.trades||[];
    S.trades.push({id:'t'+(S.nid++),key:'demo:'+i,demo:true,date,ticker,cls,name:'',side,qty,price,fees});
    if(side==='C')put({type:'aporte',date,value:Math.round((qty*price+fees)*100)/100,desc:t('data.tradeBuy',{ticker,qty,price:String(price).replace('.',decimalSeparator())}),acc:demoAccountFor(cls)});
  });
}

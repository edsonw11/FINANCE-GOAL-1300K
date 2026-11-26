/**
 * The realised result of what was sold (average-cost method), checked against a hand calculation: domain/portfolio.js realizedTotal and positions.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,near,res}=suite('portfolio-realized');
  const J=JSON.stringify,t=(id,date,ticker,side,qty,price,fees)=>({id,date,ticker,cls:'acao',side,qty,price,fees,name:ticker});
  const total=trades=>run(`realizedTotal(${J(trades)})`),pos=trades=>run(`positions(${J(trades)})`);
  // AAA: 10 @ 10 and 10 @ 20 -> average 15; sells 5 @ 30 with 5 of fees: (5*30-5) - 15*5 = 70
  const aaa=[t(1,'2026-01-02','AAA','C',10,10,0),t(2,'2026-01-03','AAA','C',10,20,0),t(3,'2026-01-04','AAA','V',5,30,5)];
  near('one sale: proceeds minus fees minus average cost',total(aaa),70);
  eq('what is left keeps the average cost: 15 shares, 225',pos(aaa).map(p=>[p.qty,p.cost,p.avg]),[[15,225,15]]);
  // BBB: buys 100 @ 2 with 1 of fees (cost 201, avg 2.01); sells all @ 1.5 with 1 of fees: (150-1) - 201 = -52
  const bbb=[t(4,'2026-02-01','BBB','C',100,2,1),t(5,'2026-02-10','BBB','V',100,1.5,1)];
  near('a loss is negative',total(bbb),-52);
  eq('a closed position is empty',pos(bbb).map(p=>[p.qty,p.cost,p.avg]),[[0,0,0]]);
  near('the total adds gains and losses of different tickers (70 - 52)',total(aaa.concat(bbb)),18);
  near('the order of the list does not matter (sorted by date, then id)',total(aaa.concat(bbb).reverse()),18);
  near('buys only: nothing realised',total([t(6,'2026-03-01','CCC','C',10,10,0)]),0);
  near('no trades: zero',total([]),0);
  near('a sale before the buy (older note missing) realises only what the notes show, flagged as oversold',total([t(7,'2026-04-01','DDD','V',10,5,0)]),50);
  eq('and the position says so',pos([t(7,'2026-04-01','DDD','V',10,5,0)]).map(p=>[p.oversold,p.qty]),[[true,0]]);
  near('a second sale uses the average that is left, not the first purchase price',total([t(8,'2026-05-01','EEE','C',10,10,0),t(9,'2026-05-02','EEE','V',5,12,0),t(10,'2026-05-03','EEE','V',5,8,0)]),(60-50)+(40-50));
  near('cents are not lost to float noise',total([t(11,'2026-06-01','FFF','C',3,0.1,0),t(12,'2026-06-02','FFF','V',3,0.2,0)]),0.3);
  eq('without an argument it reads the trades of the state',run(`(()=>{S=seed();S.trades=${J(aaa)};return realizedTotal();})()`),70);
  // ---- trades of the same day are taken in id order, whatever order they arrive in
  const sameDay=[t(1,'2026-02-02','DDD','C',10,10,0),t(2,'2026-02-02','DDD','V',5,30,0)];
  eq('same day, buy (id 1) then sell (id 2): result 100, nothing oversold',[total(sameDay),pos(sameDay)[0].oversold],[100,false]);
  eq('the same trades listed in the other order give the same result',[total(sameDay.slice().reverse()),pos(sameDay.slice().reverse())[0].oversold],[100,false]);
  const sellFirst=[t(1,'2026-02-02','EEE','V',5,30,0),t(2,'2026-02-02','EEE','C',10,10,0)];
  eq('same day, sell has the lower id: it is taken first, so it is an oversell (the id decides, not the list order)',[pos(sellFirst)[0].oversold,pos(sellFirst.slice().reverse())[0].oversold],[true,true]);
  eq('an earlier date always comes first, whatever the ids',pos([t(9,'2026-02-03','FFF','V',5,30,0),t(8,'2026-02-02','FFF','C',10,10,0)])[0].oversold,false);
  return res;};

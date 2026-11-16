/**
 * Portfolio: ticker classes, brokerage note reading, average-cost positions, saving trades (and the
 * contribution each buy creates). The note text is made up (same layout as a B3 note, invented values).
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('portfolio');
  const J=JSON.stringify;
  const note=['NOTA DE NEGOCIAÇÃO','Data pregão 05/11/2026','Negócios realizados',
    '1-BOVESPA C VISTA PETR4 PN N2 100 38,20 3.820,00 D','1-BOVESPA C VISTA FII HGLG CI ER 40 158,00 6.320,00 D',
    '1-BOVESPA C VISTA IVVB11 CI 20 310,00 6.200,00 D','1-BOVESPA V VISTA VALE3 ON NM 10 60,00 600,00 C',
    'Taxa de liquidação 1,50 D','Emolumentos 0,50 D','Corretagem 8,00 D','Total custos / despesas 10,00 D'].join('\n');
  const cls=t=>run(`classOfTicker(${J(t)},'')`);
  eq('ticker classes',[cls('PETR4'),cls('HGLG11'),cls('IVVB11'),cls('AAPL34'),cls('SANB11')],['acao','fii','etf','bdr','acao']);
  eq('not a note',run(`parseBrokerageNote('05/11 PADARIA 12,50')`),null);
  const n=run(`parseBrokerageNote(${J(note)})`);
  eq('date and number of trades',[n.date,n.trades.length,n.costs],['2026-11-05',4,10]);
  eq('trades read',n.trades.map(t=>[t.side,t.ticker,t.cls,t.qty,t.price]),
    [['C','PETR4','acao',100,38.2],['C','HGLG11','fii',40,158],['C','IVVB11','etf',20,310],['V','VALE3','acao',10,60]]);
  eq('costs are shared and add up exactly',Math.round(n.trades.reduce((s,t)=>s+t.fees,0)*100)/100,10);
  ok('missing date is reported',!!run(`parseBrokerageNote('Nota de negociação 1-BOVESPA C VISTA PETR4 PN 1 1,00 1,00')`).error);
  const header=run(`parseBrokerageNote(${J('NOTA DE NEGOCIAÇÃO\nNr. nota Folha Data pregão\n1234567 1 05/11/2026\n1-BOVESPA C VISTA PETR4 PN N2 100 38,20 3.820,00 D')})`);
  eq('date after other header cells (label and value on different lines)',header.date,'2026-11-05');
  // positions: average cost with costs, partial sell
  run(`S=seed();S.tx=[];S.trades=[
    {id:'t1',date:'2026-01-10',ticker:'PETR4',cls:'acao',side:'C',qty:100,price:10,fees:0},
    {id:'t2',date:'2026-02-10',ticker:'PETR4',cls:'acao',side:'C',qty:100,price:20,fees:0},
    {id:'t3',date:'2026-03-10',ticker:'PETR4',cls:'acao',side:'V',qty:50,price:30,fees:0}]`);
  eq('average cost and realized result',run("positions().map(p=>[p.qty,p.avg,p.cost,p.realized])"),[[150,15,2250,750]]);
  eq('groups by class with share',run("portfolioGroups().map(g=>[g.cls,g.cost,g.share])"),[['acao',2250,1]]);
  run("S.trades.push({id:'t4',date:'2026-04-01',ticker:'XPTO3',cls:'acao',side:'V',qty:5,price:1,fees:0})");
  ok('selling more than bought is flagged',run("positions().find(p=>p.ticker==='XPTO3').oversold"));
  // commit: trades saved, buys become aportes in the account of the class, selling creates none
  run("S=seed();S.tx=[];S.trades=[]");
  const saved=run(`(()=>{const x=parseBrokerageNote(${J(note)});return commitTrades(x.trades,{date:x.date});})()`);
  eq('saved 4, 3 bought',[saved.saved,saved.bought],[4,3]);
  // costs 10,00 are shared over all 4 trades (16.940,00 traded), so each buy costs a little more than its value
  eq('aportes per class account (value + share of the costs)',run("S.tx.filter(t=>t.type==='aporte').map(t=>[accName(t.acc),t.value]).sort((a,b)=>a[0]<b[0]?-1:1)"),
    [['Ações',3822.26],['ETFs',6203.66],['FIIs',6323.73]]);
  eq('same note again saves nothing twice',run(`(()=>{const x=parseBrokerageNote(${J(note)});return commitTrades(x.trades,{date:x.date});})()`),{saved:0,skipped:4,bought:0});
  eq('still 3 aportes',run("S.tx.filter(t=>t.type==='aporte').length"),3);
  eq('invalid ticker refused',run("commitTrades([{side:'C',ticker:'',qty:1,price:1,fees:0,cls:'acao'}],{date:'2026-11-05'})"),{error:'Corrija: Código do ativo (ex.: PETR4)'});
  return res;};

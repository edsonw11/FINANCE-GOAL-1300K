/** Budget per group, monthly bills (paid / scheduled / missing) and the transaction list filter. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,near,res}=suite('budgets-bills-filter');
  run(`S=seed();S.tx=[];S.budgets={};initCats();let id=1;
    globalThis.add=(date,value,cat,desc,extra)=>S.tx.push(Object.assign({id:id++,type:'despesa',date,value,cat,desc,fonte:'caixa',splits:[]},extra||{}));
    // three closed months of bills + a market that happens several times a month
    for(const m of ['2026-08','2026-09','2026-10']){add(m+'-05',700,'Moradia','Condomínio');add(m+'-15',190,'Luz','Conta de luz');
      add(m+'-08',300,'Mercado','Mercado');add(m+'-22',250,'Mercado','Mercado');}
    add('2026-09-12',426,'Saúde','Convênio');add('2026-10-12',426,'Saúde','Convênio');
    add('2026-09-20',80,'Lazer','Cinema'); // once only: not a bill
    // november (in progress, today = 2026-11-10)
    add('2026-11-05',712,'Moradia','condominio ',{splits:[{cat:'Água',value:60}]});
    add('2026-11-25',99,'Assinaturas','Streaming',{serie:7});
    add('2026-11-08',350,'Mercado','Mercado');
    S.tx.push({id:id++,type:'receita',date:'2026-11-01',value:5000,cat:'Salário',fonte:'caixa',desc:'Salário',splits:[]});`);
  // ---- budgets
  eq('no budget: no rows',run("budgetStatus('2026-11','2026-11-10').rows"),[]);
  eq('set budget',run("setBudget('Moradia',1100)"),{group:'Moradia',value:1100});
  eq('negative refused',run("setBudget('Moradia',-5)").error,'O orçamento não pode ser negativo');
  eq('no group refused',run("setBudget('',10)").error,'Escolha o grupo');
  run("setBudget('Alimentação',400);setBudget('Saúde',1000)");
  const st=run("budgetStatus('2026-11','2026-11-10')");
  eq('only groups with a budget',st.rows.map(r=>r.group).sort(),['Alimentação','Moradia','Saúde']);
  const mor=st.rows.find(r=>r.group==='Moradia');
  eq('Moradia spent = condomínio incl. split água',mor.spent,712);
  eq('remaining',mor.remaining,388);
  eq('ok under 80%',mor.level,'ok');
  ok('pace: 712 by day 10 projects over 1100',mor.onPaceToExceed&&mor.projected>1100);
  const ali=st.rows.find(r=>r.group==='Alimentação');
  eq('near from 80%',ali.level,'near');near('share',ali.share,350/400);
  eq('worst first',st.rows[0].group,'Alimentação');
  eq('totals',[st.budget,st.spent],[2500,1062]);
  run("add('2026-11-09',100,'Mercado','Feira')");
  eq('over 100%',run("budgetStatus('2026-11','2026-11-10').rows[0]").level,'over');
  eq('over: negative remaining',run("budgetStatus('2026-11','2026-11-10').rows[0]").remaining,-50);
  eq('closed month has no projection',run("budgetStatus('2026-10','2026-11-10').rows.find(r=>r.group==='Moradia').projected"),null);
  eq('alerts only for the groups touched',run("budgetAlerts('2026-11',['Mercado'],groupOf,'2026-11-10')").map(a=>a.group),['Alimentação']);
  eq('no alert for an ok group',run("budgetAlerts('2026-11',['Luz'],groupOf,'2026-11-10')"),[]);
  eq('zero removes the budget',(run("setBudget('Saúde',0)"),run("'Saúde' in S.budgets")),false);
  // ---- monthly bills
  const b=run("monthlyBills('2026-11','2026-11-10')"),by=d=>b.items.find(i=>i.desc.trim().toLowerCase()===d);
  eq('condomínio entered: paid (same bill despite accent/case/spaces)',by('condominio').status,'paid');
  eq('series in the future: scheduled',by('streaming').status,'scheduled');
  eq('luz not entered yet: missing',by('conta de luz').status,'missing');
  eq('missing uses the last value',by('conta de luz').value,190);
  eq('missing expected on the same day',by('conta de luz').date,'2026-11-15');
  eq('convênio (2 of 3 months) missing',by('convênio').status,'missing');
  ok('market several times a month is not a bill',!b.items.some(i=>i.cat==='Mercado'));
  ok('one-off is not a bill',!b.items.some(i=>i.desc==='Cinema'));
  ok('income is not a bill',!b.items.some(i=>i.cat==='Salário'));
  eq('missing first, then scheduled, then paid',b.items.map(i=>i.status),['missing','missing','scheduled','paid']);
  eq('counts',[b.count,b.paidCount],[4,1]);
  eq('pending = missing + scheduled',b.pending,190+426+99);
  eq('paid total',b.paid,712);
  run("add('2026-11-15',201.5,'Luz','Conta de luz')");
  eq('once entered it is no longer missing',run("monthlyBills('2026-11','2026-11-20').items.find(i=>i.desc==='Conta de luz').status"),'paid');
  // variation: once a month but with very different values is not a bill
  run("add('2026-08-20',120,'Restaurantes','Restaurante');add('2026-09-20',310,'Restaurantes','Restaurante');add('2026-10-20',60,'Restaurantes','Restaurante')");
  ok('very variable value is not a bill',!run("monthlyBills('2026-11','2026-11-20')").items.some(i=>i.cat==='Restaurantes'));
  // "Não é conta"
  const key=run("monthlyBills('2026-11','2026-11-20').items.find(i=>i.desc==='Convênio').key");
  eq('hide a bill',run(`ignoreBill(${JSON.stringify(key)})`),{key});
  ok('hidden bill is gone',!run("monthlyBills('2026-11','2026-11-20')").items.some(i=>i.desc==='Convênio'));
  eq('hidden count',run("monthlyBills('2026-11','2026-11-20').ignoredCount"),1);
  eq('hiding twice keeps one entry',(run(`ignoreBill(${JSON.stringify(key)})`),run("S.billsIgnored.length")),1);
  eq('restore',run("restoreIgnoredBills()"),{restored:1});
  ok('back after restore',run("monthlyBills('2026-11','2026-11-20')").items.some(i=>i.desc==='Convênio'));
  eq('hide without key refused',run("ignoreBill('')").error,'Conta não encontrada');
  // ---- transaction filter
  eq('month + all types',run("filterTransactions('2026-11',{}).length"),6);
  eq('by type',run("filterTransactions('2026-11',{type:'receita'}).map(r=>r.t.cat)"),['Salário']);
  eq('by group: only expenses with a part in the group',run("filterTransactions('2026-11',{group:'Moradia'}).map(r=>r.t.desc).sort()"),['Conta de luz','condominio ']);
  eq('by group: value is the part in the group',run("filterTransactions('2026-11',{group:'Moradia'}).find(r=>r.t.desc==='condominio ').value"),712);
  eq('split part in another group counts only that part',(run("S.tx.find(t=>t.desc==='Feira').splits=[{cat:'Farmácia',value:30}]"),run("filterTransactions('2026-11',{group:'Saúde'}).map(r=>r.value)")),[30]);
  eq('search in description, category and split categories',run("filterTransactions('2026-11',{query:'farmácia'}).map(r=>r.t.desc)"),['Feira']);
  eq('search is case-insensitive',run("filterTransactions('2026-11',{query:'STREAM'}).length"),1);
  eq('newest first',run("filterTransactions('2026-11',{type:'despesa'}).map(r=>r.t.date)[0]"),'2026-11-25');
  eq('signed total (income +, expenses −)',run("listTotal(filterTransactions('2026-11',{}))"),5000-712-99-350-100-201.5);
  return res;};

/** Commands used by the screens: categories, accounts, settings, backup import, demo data. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('commands');
  run("S=seed();S.tx=[];initCats();");
  // categories
  const n0=run("S.cats.despesa.length");
  eq('add category (group suggested by name)',run("addCategory('despesa','Pet shop','🐶')"),{name:'Pet shop',group:'Família'});
  eq('duplicate refused',run("addCategory('despesa','pet SHOP','🐶')"),{error:'Essa categoria já existe'});
  eq('empty name refused',run("addCategory('despesa','  ','')"),{error:'Digite o nome da categoria'});
  const i=run("S.cats.despesa.findIndex(c=>c.name==='Pet shop')");
  run(`setCategoryEnabled('despesa',${i},false)`);eq('disable',run(`S.cats.despesa[${i}].off`),true);
  run(`setCategoryEnabled('despesa',${i},true)`);eq('enable removes the flag',run(`'off' in S.cats.despesa[${i}]`),false);
  run(`setCategoryIcon('despesa',${i},'')`);eq('empty icon gets default',run(`S.cats.despesa[${i}].icon`),'🏷️');
  run("S.tx.push({id:1,type:'despesa',date:'2026-10-01',value:10,cat:'Pet shop',fonte:'caixa',splits:[]});");
  eq('rename moves transactions',(run(`renameCategoryAt('despesa',${i},'Pets')`),run("S.tx[0].cat")),'Pets');
  eq('rename to existing refused',run(`renameCategoryAt('despesa',${i},'Mercado')`).error,'Já existe uma categoria com esse nome. Para juntar as duas, exclua uma e mova os lançamentos.');
  eq('delete used without target refused',run(`deleteCategoryAt('despesa',${i},'')`),{error:'Escolha para qual categoria os lançamentos vão'});
  run(`deleteCategoryAt('despesa',${i},'Mercado')`);
  eq('delete moves transactions',run("S.tx[0].cat"),'Mercado');eq('delete removes',run("S.cats.despesa.length"),n0);
  eq('add suggested skips existing',run("addCategories([{name:'Mercado',icon:'x'},{name:'Feira',icon:'🥬'}])"),{added:1});
  // accounts and balances
  const a=run("addAccount('XP CDB')");ok('account created',a.id&&run(`S.accounts.some(x=>x.id==='${a.id}')`));
  eq('empty account name',run("addAccount(' ')"),{error:'Digite o nome da conta'});
  run(`saveSnapshots('2026-11-01',[{acc:'${a.id}',value:1000,gross:1100}])`);
  eq('snapshot saved',run(`balance('${a.id}','2026-11-02')`).v,1000);
  eq('archive with balance refused',run(`archiveAccount('${a.id}')`).error.startsWith('Primeiro zere o saldo'),true);
  run(`saveSnapshots('2026-11-02',[{acc:'${a.id}',value:0,gross:0}])`);
  eq('one snapshot per day',run(`S.snaps.filter(s=>s.acc==='${a.id}'&&s.date==='2026-11-02').length`),1);
  run(`archiveAccount('${a.id}')`);ok('archived',run(`S.accounts.find(x=>x.id==='${a.id}').archived`));
  // settings
  eq('card settings are clamped (0 = default)',run("setCardSettings({best:45,due:0,biz:false})"),{best:31,due:7,biz:false});
  run("setCardSettings({best:29,due:7,biz:true});setClosingOverride('2026-12','2026-11-27')");
  eq('closing override',run("closeDateOf('2026-12')"),'2026-11-27');
  run("setClosingOverride('2026-12',ruleClosing('2026-12'))");eq('override equal to rule is removed',run("'2026-12' in (CARD().over||{})"),false);
  run("setGoalSettings({goal:0,rate:10,planned:5000})");eq('goal 0 falls back to default',run("[S.goal,S.rate,S.planned]"),[1300000,10,5000]);
  // backup import (pure: returns the new state)
  const imp=run("importBackup({v:2,goal:1,rate:1,planned:0,nid:1,accounts:[],snaps:[],tx:[]})");eq('v2 imported as is',[imp.converted,imp.state.goal],[false,1]);
  const old=run("importBackup({goal:900000,rate:10,planned:0,entries:{'2026-01':{bal:[10,20,0,0],ap:[5,0,0,0]}}})");
  eq('old backup converted',[old.converted,old.state.snaps.length,old.state.tx.length],[true,4,1]);
  eq('invalid backup',run("importBackup({foo:1})"),{error:'Arquivo inválido'});
  // demo data
  run("S=seed();S.tx=[{id:1,type:'despesa',date:'2026-10-01',value:9,cat:'Mercado',fonte:'caixa'}];initCats();");
  const n=run("addDemoData()");ok('demo created',n>100&&run("S.tx.filter(t=>t.demo).length")===n);
  eq('demo removal keeps real data',[run("removeDemoData()"),run("S.tx.length")],[n,1]);
  return res;};

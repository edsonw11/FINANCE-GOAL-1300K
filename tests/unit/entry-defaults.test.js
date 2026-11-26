/** A new category is created only on purpose (closest existing one suggested); "Pago com" starts with the last method used. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('entry-defaults');
  const J=JSON.stringify;
  run(`S=blankState();S.cats={despesa:[{name:'Mercado'},{name:'Farmácia'},{name:'Contas (luz, água, net)'},{name:'Restaurante'}],receita:[{name:'Salário'}]};`);
  const m=(type,name)=>run(`matchCategory(${J(type)},${J(name)})`);
  eq('existing name: nothing to ask',m('despesa','Mercado'),{name:'Mercado',exists:true,same:null,suggestion:null});
  eq('same name written differently uses the existing one',m('despesa','farmacia').same,'Farmácia');
  eq('a typo suggests the closest',m('despesa','Mercadoo'),{name:'Mercadoo',exists:false,same:null,suggestion:'Mercado'});
  eq('a word of a longer name is close',m('despesa','luz').suggestion,'Contas (luz, água, net)');
  eq('nothing similar: no suggestion',m('despesa','Viagem').suggestion,null);
  eq('categories are per type',m('receita','Mercadoo').suggestion,null);
  eq('similarity limits',[run("nameSimilarity('Mercado','mercado')"),run("nameSimilarity('','x')")],[1,0]);
  eq('new categories of a record: main and splits, once each, existing ones skipped',
    run(`newCategories('despesa',['Mercadoo','Mercado','Viagem','Mercadoo','']).map(x=>[x.name,x.suggestion])`),[['Mercadoo','Mercado'],['Viagem',null]]);
  eq('aporte and fatura have no category',run(`newCategories('aporte',['Nova'])`),[]);
  // last payment method
  eq('no record yet: account',run("lastSource('despesa')"),'caixa');
  run(`S.tx=[{id:1,type:'despesa',fonte:'cartao'},{id:5,type:'despesa',fonte:'beneficio'},{id:3,type:'despesa',fonte:'caixa'},
    {id:9,type:'despesa',fonte:'caixa',imp:'i1'},{id:10,type:'despesa',fonte:'caixa',demo:true},{id:7,type:'receita',fonte:'beneficio'}]`);
  eq('the newest record typed by hand of the same type (imports and test data ignored)',[run("lastSource('despesa')"),run("lastSource('receita')")],['beneficio','beneficio']);
  return res;};

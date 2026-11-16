/** Validation and saving of a transaction: new, series, edit, future siblings (domain/transaction-builder.js). */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,ok,res}=suite('transaction builder');
  run("S=seed();S.tx=[];initCats();");
  const base="{type:'despesa',value:350,date:'2026-10-05',cat:'Mercado',fonte:'caixa',desc:'Feira',splits:[],repeat:1}";
  eq('valid',run(`validateTransaction(${base})`),null);
  eq('value required',run(`validateTransaction(Object.assign(${base},{value:0}))`).field,'value');
  eq('date required',run(`validateTransaction(Object.assign(${base},{date:''}))`).field,'date');
  eq('account required for contribution',run(`validateTransaction({type:'aporte',value:10,date:'2026-10-05',acc:''})`).field,'acc');
  eq('splits above total',run(`validateTransaction(Object.assign(${base},{splits:[{cat:'Saúde',value:400}]}))`).field,'value');
  eq('invoice items above value',run(`validateTransaction({type:'fatura',value:10,date:'2026-10-05',invoiceSelectedTotal:20})`).field,'value');
  // new
  const r=run(`saveTransaction(${base})`);
  eq('creates one',r.ids.length,1);
  eq('fields',run("(({type,value,date,cat,fonte,desc})=>({type,value,date,cat,fonte,desc}))(S.tx[0])"),{type:'despesa',value:350,date:'2026-10-05',cat:'Mercado',fonte:'caixa',desc:'Feira'});
  ok('unknown category is created',run("saveTransaction(Object.assign("+base+",{cat:'Pet shop'}))&&S.cats.despesa.some(c=>c.name==='Pet shop')"));
  eq('empty category gets default',run(`(saveTransaction(Object.assign(${base},{cat:''})),S.tx[S.tx.length-1].cat)`),'Imprevistos / Outros');
  // series
  run("S.tx=[];");
  const s=run(`saveTransaction(Object.assign(${base},{repeat:3}))`);
  eq('series creates 3',s.ids.length,3);
  eq('series dates',run("S.tx.map(t=>t.date)"),['2026-10-05','2026-11-05','2026-12-05']);
  ok('series share an id',run("S.tx.every(t=>t.serie&&t.serie===S.tx[0].serie)"));
  // edit (no duplicate) + future siblings
  const e=run(`saveTransaction(Object.assign(${base},{editId:S.tx[0].id,value:400,applyToFuture:true}))`);
  eq('edit does not duplicate',run("S.tx.length"),3);
  eq('edit updates future siblings',run("S.tx.map(t=>t.value)"),[400,400,400]);
  eq('edit keeps sibling dates',run("S.tx.map(t=>t.date)"),['2026-10-05','2026-11-05','2026-12-05']);
  eq('edit reports siblings',e.siblings,2);
  run(`saveTransaction(Object.assign(${base},{editId:S.tx[0].id,value:500,applyToFuture:false}))`);
  eq('edit only this one',run("S.tx.map(t=>t.value)"),[500,400,400]);
  // other types
  run(`saveTransaction({type:'aporte',value:1000,date:'2026-10-10',acc:'nu',desc:''})`);
  ok('contribution has account, no category',run("(t=>t.acc==='nu'&&!t.cat&&!t.fonte)(S.tx[S.tx.length-1])"));
  run(`saveTransaction({type:'fatura',value:300,date:'2026-10-07',fm:'2026-10',items:[999],desc:''})`);
  ok('invoice keeps only existing items',run("(t=>t.cat==='Fatura do cartão'&&t.fm==='2026-10'&&t.items.length===0)(S.tx[S.tx.length-1])"));
  run(`saveTransaction(Object.assign(${base},{splits:[{cat:'Saúde',value:99.9}]}))`);
  eq('splits stored',run("S.tx[S.tx.length-1].splits"),[{cat:'Saúde',value:99.9}]);
  return res;};

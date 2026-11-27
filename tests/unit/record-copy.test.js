/**
 * Repeating a record that is split across categories (bug found by the owner): "Repetir" (copy into a new record) and the monthly series of the
 * form both have to carry the split parts. The copy fills category, text, value, payment, investment, split parts and the reinvestment mark,
 * but not the id, the series, the bank import key or the invoice items. Texts are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,ok,res}=suite('record-copy');
  const J=JSON.stringify;
  const split={id:45,date:'2026-10-13',type:'despesa',value:1176,desc:'Pix mensal',cat:'Mae',fonte:'caixa',imp:'row:abc#1',serie:9,splits:[{cat:'Convenio',value:426},{cat:'Aluguel Casas',value:750}]};
  const copy=(t,d)=>run(`copyPrefill(${J(t)},${J(d||'2026-11-20')})`);
  // ---- the copy button
  eq('the copy carries the split parts',copy(split).splits,[{cat:'Convenio',value:426},{cat:'Aluguel Casas',value:750}]);
  eq('the copy carries category, text, value, payment and the date chosen by the caller',(p=>[p.cat,p.desc,p.value,p.fonte,p.date])(copy(split,'2026-12-01')),['Mae','Pix mensal',1176,'caixa','2026-12-01']);
  eq('the copy does not carry identity: no id, series, import key',(p=>[p.id,p.serie,p.imp,p.items])(copy(split)),[undefined,undefined,undefined,undefined]);
  eq('a record without splits has no splits key (not an empty list)',Object.keys(copy({...split,splits:undefined})).includes('splits'),false);
  eq('an empty list of splits is not copied either',Object.keys(copy({...split,splits:[]})).includes('splits'),false);
  eq('the split parts are copies: changing them does not change the original',run(`(()=>{const t=${J(split)};const p=copyPrefill(t,'2026-11-20');p.splits[0].value=1;p.splits.push({cat:'X',value:2});return [t.splits[0].value,t.splits.length];})()`),[426,2]);
  eq('a reinvestment keeps its mark when copied, a normal aporte has none',[copy({type:'aporte',value:100,acc:'nu',reinv:true}).reinv,copy({type:'aporte',value:100,acc:'nu'}).reinv],[true,undefined]);
  eq('an aporte copy carries its investment',copy({type:'aporte',value:100,acc:'nu'}).acc,'nu');
  // ---- the monthly series (Repetir "Todo mês" in the form) keeps the split parts in every month
  run("S=seed();S.tx=[];initCats();");
  const form="{type:'despesa',value:1176,date:'2026-10-13',cat:'Mae',fonte:'caixa',desc:'Pix mensal',splits:[{cat:'Convenio',value:426},{cat:'Aluguel Casas',value:750}],repeat:4}";
  run(`saveTransaction(${form})`);
  eq('a series of 4 has the split parts in all 4 months',run("S.tx.map(t=>[t.date,t.splits])"),
    ['2026-10-13','2026-11-13','2026-12-13','2027-01-13'].map(d=>[d,[{cat:'Convenio',value:426},{cat:'Aluguel Casas',value:750}]]));
  ok('each month has its own copy of the parts (not one shared object)',run("S.tx[0].splits!==S.tx[1].splits&&S.tx[1].splits!==S.tx[2].splits"));
  eq('the parts keep adding up: every month still totals 1176 by category',run("S.tx.map(t=>catParts(t).reduce((a,p)=>a+p.value,0))"),[1176,1176,1176,1176]);
  eq('the month sums split the same way in every month (Convenio 426 each)',run("['2026-10','2026-11','2026-12','2027-01'].map(m=>catMonth(m)['Convenio'])"),[426,426,426,426]);
  // editing the first and applying to the future copies the new parts too
  run(`saveTransaction({...${form},editId:S.tx[0].id,applyToFuture:true,splits:[{cat:'Convenio',value:500},{cat:'Aluguel Casas',value:676}],repeat:1})`);
  eq('editing with "apply to future" changes the split parts of every future month',run("S.tx.map(t=>t.splits.map(s=>s.value))"),[[500,676],[500,676],[500,676],[500,676]]);
  // removing the parts in the edit removes them from the future copies as well
  run(`saveTransaction({...${form},editId:S.tx[0].id,applyToFuture:true,splits:[],repeat:1})`);
  eq('removing the parts and applying to future leaves no parts in any month',run("S.tx.map(t=>t.splits===undefined)"),[true,true,true,true]);
  return res;};

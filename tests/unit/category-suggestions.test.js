/**
 * The one-tap categories under the category field (and under each part of a split): the most used in the last 6 months, completed from the
 * catalog, never an archived one. They used to be drawn but did nothing when tapped, and the split had only a small typed list. Values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,res}=suite('category-suggestions');
  const load=(cats,tx)=>run(`S=seed();S.cats=${JSON.stringify(cats)};S.tx=${JSON.stringify(tx)}.map((t,i)=>Object.assign({id:i+1,type:'despesa',value:10},t));_al=null;`);
  const names=(type,n)=>run(`topCategories('${type}'${n?','+n:''})`);
  const on=n=>({name:n}),off=n=>({name:n,off:true});
  load({despesa:['A','B','C','D','E','F','G','H'].map(on),receita:[on('Salário'),on('Extra')]},[]);
  eq('with no history it offers the first catalog categories up to the limit of 6',names('despesa'),['A','B','C','D','E','F']);
  eq('another limit is respected',names('despesa',3),['A','B','C']);
  eq('income has its own catalog',names('receita'),['Salário','Extra']);
  load({despesa:['A','B','C','D','E','F','G','H'].map(on)},[{cat:'H',date:'2026-11-01'},{cat:'H',date:'2026-10-01'},{cat:'G',date:'2026-11-02'}]);
  eq('the most used come first, then the rest of the catalog',names('despesa'),['H','G','A','B','C','D']);
  load({despesa:['A','B','C'].map(on)},[{cat:'B',date:'2026-11-01'},{cat:'C',date:'2026-11-02'}]);
  eq('a tie is broken by name, so the order does not change from one draw to the next',names('despesa'),['B','C','A']);
  load({despesa:[on('A'),off('B'),on('C')]},[{cat:'B',date:'2026-11-01'},{cat:'B',date:'2026-11-02'}]);
  eq('an archived category is never offered, even if it was used',names('despesa'),['A','C']);
  load({despesa:['A','B'].map(on)},[{cat:'B',date:'2026-03-01'},{cat:'B',date:'2026-03-02'},{cat:'A',date:'2026-11-01'}]);
  eq('use older than 6 months does not count',names('despesa'),['A','B']);
  load({despesa:['A','B'].map(on)},[{cat:'B',type:'receita',date:'2026-11-01'},{cat:'B',type:'aporte',date:'2026-11-02'},{cat:'Unknown',date:'2026-11-03'}]);
  eq('other kinds of record and categories outside the catalog do not count',names('despesa'),['A','B']);
  load({},[]);
  eq('no catalog for the kind: nothing offered',names('despesa'),[]);
  return res;};

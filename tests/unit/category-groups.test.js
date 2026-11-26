/** Expense groups: default setup, suggestion by name, totals by group and the group commands. */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,ok,near,res}=suite('category-groups');
  // a user that already has categories, one of them unknown to the defaults
  run(`S=seed();S.tx=[];delete S.cats;delete S.catsV2;delete S.catsV3;delete S.catsV4;delete S.groups;initCats();
    S.cats.despesa.push({name:'Wellhub',icon:'🏋️'},{name:'Coisas aleatórias',icon:'🎲'});delete S.catsV4;
    S.cats.despesa.find(c=>c.name==='Lazer').group='Meu grupo';S.groups.push({name:'Meu grupo',icon:'⭐'});initCats();`);
  // default setup
  eq('Luz is in Moradia',run("groupOf('Luz')"),'Moradia');
  eq('Água is in Moradia',run("groupOf('Água')"),'Moradia');
  eq('Gás is in Moradia',run("groupOf('Gás')"),'Moradia');
  eq('Moradia category is in Moradia',run("groupOf('Moradia')"),'Moradia');
  eq('Academia is in Saúde',run("groupOf('Academia')"),'Saúde');
  eq('existing unknown category placed by keyword (Wellhub -> Saúde)',run("groupOf('Wellhub')"),'Saúde');
  eq('unknown name stays alone',run("groupOf('Coisas aleatórias')"),'Coisas aleatórias');
  eq('setup keeps a group chosen by the user',run("groupOf('Lazer')"),'Meu grupo');
  eq('group icon from the catalog',run("groupIcon('Moradia')"),'🏠');
  eq('lone category uses its own icon',run("groupIcon('Coisas aleatórias')"),'🎲');
  ok('Moradia lists its categories',run("['Moradia','Luz','Água','Gás'].every(c=>categoriesOfGroup('Moradia').includes(c))"));
  eq('lone category is a group of one',run("categoriesOfGroup('Coisas aleatórias')"),['Coisas aleatórias']);
  eq('setup runs once',run("const n=S.groups.length;initCats();S.groups.length===n"),true);
  // suggestion by name
  eq('suggest Wellhub',run("suggestGroup('wellhub')"),'Saúde');
  eq('suggest gym',run("suggestGroup('Smart Fit')"),'Saúde');
  eq('suggest convênio',run("suggestGroup('Convênio médico')"),'Saúde');
  eq('suggest conta de água',run("suggestGroup('Conta de água')"),'Moradia');
  eq('gasolina is transport, not gás',run("suggestGroup('Gasolina')"),'Transporte');
  eq('gás de cozinha is Moradia',run("suggestGroup('Gás de cozinha')"),'Moradia');
  eq('suggest iFood',run("suggestGroup('iFood')"),'Alimentação');
  eq('unknown name',run("suggestGroup('Xyz')"),null);
  // totals by group: same grand total, split parts go to their groups
  run(`S.tx=[
    {id:1,type:'despesa',date:'2026-09-09',value:547,cat:'Moradia',fonte:'caixa',desc:'condominio',splits:[{cat:'Água',value:60},{cat:'Gás',value:40}]},
    {id:2,type:'despesa',date:'2026-09-10',value:190,cat:'Luz',fonte:'caixa',splits:[]},
    {id:3,type:'despesa',date:'2026-09-11',value:120,cat:'Wellhub',fonte:'caixa',splits:[]},
    {id:4,type:'despesa',date:'2026-09-12',value:426,cat:'Saúde',fonte:'caixa',desc:'Convenio',splits:[]},
    {id:5,type:'despesa',date:'2026-09-13',value:33.3,cat:'Coisas aleatórias',fonte:'caixa',splits:[]}];`);
  const g=run("groupMonth('2026-09')"),c=run("catMonth('2026-09')");
  eq('Moradia = condomínio + água + gás + luz',g['Moradia'],737);
  eq('Saúde = convênio + Wellhub',g['Saúde'],546);
  eq('lone category keeps its total',g['Coisas aleatórias'],33.3);
  near('same grand total as by category',Object.values(g).reduce((a,b)=>a+b,0),Object.values(c).reduce((a,b)=>a+b,0));
  const it=run("groupItems('2026-09','Moradia')");
  eq('split record shows once in its group',it.filter(i=>i.t.id===1).length,1);
  eq('split record value = sum of its parts in the group',it.find(i=>i.t.id===1).value,547);
  eq('split record lists the categories',it.find(i=>i.t.id===1).cats.sort(),['Gás','Moradia','Água'].sort());
  near('items add up to the group total',it.reduce((a,i)=>a+i.value,0),737);
  eq('analysis months are by group',run("closedMonthsByGroup('2026-10').find(x=>x.m==='2026-09').c['Moradia']"),737);
  // commands
  const i=run("S.cats.despesa.findIndex(c=>c.name==='Coisas aleatórias')");
  eq('move category to an existing group (case-insensitive)',run(`setCategoryGroup(${i},'moradia')`),{name:'Coisas aleatórias',group:'Moradia'});
  eq('its spending now counts in Moradia',run("groupMonth('2026-09')['Moradia']"),770.3);
  eq('typing a new name creates the group',run(`setCategoryGroup(${i},'Hobbies')`).group,'Hobbies');
  ok('new group in the catalog with the category icon',run("S.groups.some(g=>g.name==='Hobbies'&&g.icon==='🎲')"));
  eq('empty removes the group',run(`setCategoryGroup(${i},'')`),{name:'Coisas aleatórias',group:null});
  eq('without group it stands alone',run("groupOf('Coisas aleatórias')"),'Coisas aleatórias');
  eq('unknown category refused',run("setCategoryGroup(999,'X')").error,'Categoria não encontrada');
  run("setGroupIcon('Moradia','🏡')");eq('group icon changed',run("groupIcon('Moradia')"),'🏡');
  eq('group icon of unknown group refused',run("setGroupIcon('Nada','x')").error,'Grupo não encontrado');
  eq('new category gets the suggested group',run("addCategory('despesa','Academia do bairro','')").group,'Saúde');
  eq('suggested categories get their group',(run("addCategories([{name:'Farmácia popular',icon:'💊'}])"),run("groupOf('Farmácia popular')")),'Saúde');
  eq('income categories have no group',run("addCategory('receita','Bônus anual','')").group,null);
  eq('renaming a category keeps its group',(run(`renameCategoryAt('despesa',S.cats.despesa.findIndex(c=>c.name==='Luz'),'Energia')`),run("groupOf('Energia')")),'Moradia');
  return res;};

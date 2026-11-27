/**
 * "Onde gastei no mês" (bug found by the owner): a phone bill of R$ 30 showed as "🏠 Moradia" with no hint that it was the phone, because Telefone belongs to the group
 * Moradia. The group now says what it is made of. groupParts gives the categories of each group (same totals as groupMonth), partsText the short text under the group name.
 * Texts and values are made up.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext({today:'2026-11-20'}),{eq,res}=suite('spending-group-parts');
  const J=JSON.stringify;
  const load=(rows)=>run(`S=seed();S.tx=[];initCats();var _id=1;${J(rows)}.forEach(r=>S.tx.push(Object.assign({id:_id++,type:'despesa',fonte:'caixa',date:'2026-11-14'},r)));_al=null;true`);
  // the owner's case: only a phone bill
  load([{cat:'Telefone',value:30}]);
  eq('the group is Moradia and it is made of Telefone only',[run("groupMonth('2026-11')"),run("groupParts('2026-11')")],[{Moradia:30},{Moradia:[{cat:'Telefone',value:30}]}]);
  eq('the text under the group names the category (not "Moradia" again)',run("partsText(groupParts('2026-11').Moradia,'Moradia')"),'Telefone');
  // several categories: biggest first, ties by name
  load([{cat:'Luz',value:80},{cat:'Telefone',value:30},{cat:'Água',value:30},{cat:'Internet',value:100},{cat:'Gás',value:10}]);
  eq('the parts are sorted by value, then by name',run("groupParts('2026-11').Moradia.map(p=>p.cat+':'+p.value)"),['Internet:100','Luz:80','Água:30','Telefone:30','Gás:10']);
  eq('the text lists the three biggest and counts the rest',run("partsText(groupParts('2026-11').Moradia,'Moradia')"),'Internet, Luz, Água +2');
  eq('exactly three parts show no "+n"',run("partsText([{cat:'A',value:3},{cat:'B',value:2},{cat:'C',value:1}],'G')"),'A, B, C');
  eq('four parts say +1',run("partsText([{cat:'A',value:4},{cat:'B',value:3},{cat:'C',value:2},{cat:'D',value:1}],'G')"),'A, B, C +1');
  // the parts always add up to the group total (same rule as groupMonth), also with split records and the undetailed part of an invoice
  load([{cat:'Mercado',value:200,splits:[{cat:'Telefone',value:30},{cat:'Luz',value:20}]},{cat:'Lazer',value:50}]);
  eq('a split record puts each part in its own category and group (Mercado 150, Telefone 30, Luz 20)',run("Object.entries(groupParts('2026-11')).sort((a,b)=>a[0].localeCompare(b[0]))"),[['Alimentação',[{cat:'Mercado',value:150}]],['Lazer e compras',[{cat:'Lazer',value:50}]],['Moradia',[{cat:'Telefone',value:30},{cat:'Luz',value:20}]]]);
  eq('for every group the parts add up to the group total',run("(()=>{const gm=groupMonth('2026-11'),gp=groupParts('2026-11');return Object.keys(gm).every(g=>Math.abs(gp[g].reduce((a,p)=>a+p.value,0)-gm[g])<0.005)&&Object.keys(gp).length===Object.keys(gm).length;})()"),true);
  // a lone category that is its own group says nothing more
  load([{cat:'Pet shop',value:40}]);
  eq('a category with no group is its own group: nothing under the name',run("partsText(groupParts('2026-11')['Pet shop'],'Pet shop')"),'');
  eq('a group with one category of another name still shows it',run("partsText([{cat:'Telefone',value:1}],'Moradia')"),'Telefone');
  eq('missing or empty parts give an empty text, never "undefined"',[run("partsText(undefined,'x')"),run("partsText([],'x')")],['','']);
  eq('an empty month has no groups',(load([]),run("groupParts('2026-11')")),{});
  return res;};

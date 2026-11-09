/**
 * domain/categories.js
 * Responsibility: Category catalog: create, rename, usage, icon and monthly totals.
 */
// ---- category catalog ----
function initCats(){
  if(!S.cats){
  const mk=(t)=>{const m=new Map(Object.entries(DEFAULT_CATEGORIES[t]).map(([n,i])=>[n,i]));
    S.tx.forEach(x=>{if(x.type!==t)return;if(x.cat&&!m.has(x.cat))m.set(x.cat,x.cat==='Contas (luz, água, net)'?'💡':'🏷️');(x.splits||[]).forEach(sp=>{if(!m.has(sp.cat))m.set(sp.cat,'🏷️');});});
    return [...m.entries()].map(([name,icon])=>({name,icon}));};
  S.cats={despesa:mk('despesa'),receita:mk('receita')};save();}
  if(!S.catsV2){ // once: adds the recommended categories and removes "Cartão de crédito" if unused (the card is now a payment method)
    SUGGESTED_CATEGORIES.forEach(([g,items])=>items.forEach(([n,i,rec])=>{if(rec&&!S.cats.despesa.some(c=>c.name.toLowerCase()===n.toLowerCase()))S.cats.despesa.push({name:n,icon:i});}));
    const k=S.cats.despesa.findIndex(c=>c.name==='Cartão de crédito');
    if(k>=0&&S.cats.despesa.length>1&&catUse('despesa','Cartão de crédito').n===0)S.cats.despesa.splice(k,1);
    S.catsV2=true;save();}
  if(!S.catsV3){ // once: expense "Outros" becomes "Imprevistos / Outros"; income gains Renda Extra and Serviços
    const d=S.cats.despesa,o=d.find(c=>c.name==='Outros'),has=d.find(c=>c.name==='Imprevistos / Outros');
    if(o&&!has){renameCat('despesa','Outros','Imprevistos / Outros');o.name='Imprevistos / Outros';o.icon='⚠️';}
    else if(o&&has){renameCat('despesa','Outros','Imprevistos / Outros');d.splice(d.indexOf(o),1);}
    else if(!has)d.push({name:'Imprevistos / Outros',icon:'⚠️'});
    [['Renda Extra','➕'],['Serviços','🛠️']].forEach(([n,i])=>{if(!S.cats.receita.some(c=>c.name.toLowerCase()===n.toLowerCase()))S.cats.receita.splice(Math.max(S.cats.receita.length-1,0),0,{name:n,icon:i});});
    S.catsV3=true;save();}
}
function ensureCat(t,name){if(!name||!S.cats||!S.cats[t])return;if(!S.cats[t].some(c=>c.name===name))S.cats[t].push({name,icon:'🏷️'});}
function catUse(t,name){let n=0,v=0;S.tx.forEach(x=>{if(x.type!==t)return;
  const parts=t==='despesa'?catParts(x):[{cat:x.cat,value:x.value}];
  const hit=parts.filter(p=>p.cat===name);if(hit.length){n++;v+=sum(hit.map(p=>p.value));}});return {n,v};}
function renameCat(t,from,to){S.tx.forEach(x=>{if(x.type!==t)return;if(x.cat===from)x.cat=to;(x.splits||[]).forEach(sp=>{if(sp.cat===from)sp.cat=to;});});}
const icon=(t,c)=>((((S.cats||{})[t])||[]).find(x=>x.name===c)||{}).icon||(DEFAULT_CATEGORIES[t]&&DEFAULT_CATEGORIES[t][c])||LEG[c]||'🏷️';
function catMonth(m){const c={};txIn(m,'despesa').forEach(t=>catParts(t).forEach(p=>c[p.cat]=(c[p.cat]||0)+p.value));
  txIn(m,'fatura').forEach(t=>{const u=invoiceUndetailed(t);if(u>0)c['Cartão (sem detalhe)']=(c['Cartão (sem detalhe)']||0)+u;});return c;}

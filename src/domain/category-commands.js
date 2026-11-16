/**
 * domain/category-commands.js
 * Responsibility: commands that change the category catalog. They validate and return
 * {error} when the change is not allowed (the screen shows the message).
 */
import { S } from './store.js';
import { catUse, renameCat } from './categories.js';
import { ensureGroup, suggestGroup } from './category-groups.js';
const sameName=(a,b)=>a.toLowerCase()===b.toLowerCase();
export function setCategoryEnabled(t,i,on){const c=S.cats[t][i];if(on)delete c.off;else c.off=true;return {name:c.name};}
export function setCategoryIcon(t,i,ic){S.cats[t][i].icon=(ic||'').trim()||'🏷️';}
export function renameCategoryAt(t,i,name){
  const c=S.cats[t][i],nn=(name||'').trim();
  if(!nn||nn===c.name)return {name:c.name,unchanged:true};
  if(S.cats[t].some((x,k)=>k!==i&&sameName(x.name,nn)))return {error:'Já existe uma categoria com esse nome. Para juntar as duas, exclua uma e mova os lançamentos.'};
  renameCat(t,c.name,nn);c.name=nn;return {name:nn};
}
export function addCategory(t,name,ic){
  const nn=(name||'').trim();
  if(!nn)return {error:'Digite o nome da categoria'};
  if(S.cats[t].some(x=>sameName(x.name,nn)))return {error:'Essa categoria já existe'};
  const c={name:nn,icon:(ic||'').trim()||'🏷️'},g=t==='despesa'?suggestGroup(nn):null;
  if(g)c.group=ensureGroup(g);
  S.cats[t].push(c);return {name:nn,group:c.group||null};
}
// a used category can only be deleted by moving its transactions to another one
export function deleteCategoryAt(t,i,moveTo){
  const c=S.cats[t][i];
  if(S.cats[t].length<=1)return {error:'Mantenha pelo menos uma categoria'};
  const used=catUse(t,c.name).n>0;
  if(used&&!moveTo)return {error:'Escolha para qual categoria os lançamentos vão'};
  if(used)renameCat(t,c.name,moveTo);
  S.cats[t].splice(i,1);return {name:c.name,movedTo:used?moveTo:null};
}
export function addCategories(list){let added=0;list.forEach(({name,icon})=>{if(!S.cats.despesa.some(c=>sameName(c.name,name))){
  const c={name,icon},g=suggestGroup(name);if(g)c.group=ensureGroup(g);S.cats.despesa.push(c);added++;}});return {added};}
// moves an expense category to a group; a new group name creates the group; empty = no group
export function setCategoryGroup(i,name){
  const c=S.cats.despesa[i],nn=(name||'').trim();
  if(!c)return {error:'Categoria não encontrada'};
  if(!nn||sameName(nn,c.name)&&!(S.groups||[]).some(g=>sameName(g.name,nn))){delete c.group;return {name:c.name,group:null};}
  c.group=ensureGroup(nn,c.icon);return {name:c.name,group:c.group};
}
// group icon (the group must exist)
export function setGroupIcon(name,ic){const g=(S.groups||[]).find(x=>x.name===name);if(!g)return {error:'Grupo não encontrado'};g.icon=(ic||'').trim()||'🏷️';return {name};}

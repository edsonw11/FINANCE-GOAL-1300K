/**
 * domain/category-groups.js
 * Responsibility: expense groups (Moradia, Saúde...): which group a category belongs to,
 * the group icon, the suggested group for a new category name and the one-time default setup.
 * A category with no group stands alone (its own name is its group).
 */
import { DEFAULT_GROUPS, GROUP_KEYWORDS } from '../core/config.js';
import { S } from './store.js';
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
const expenseCats=()=>((S.cats||{}).despesa||[]);
// group of a category name (the name itself when it has no group or is unknown)
export function groupOf(cat){const c=expenseCats().find(x=>x.name===cat);return (c&&c.group)||cat;}
export function groupIcon(g){
  const gr=(S.groups||[]).find(x=>x.name===g);if(gr)return gr.icon;
  const c=expenseCats().find(x=>x.name===g);return (c&&c.icon)||'🏷️';
}
// category names inside a group (a lone category is a group of one)
export function categoriesOfGroup(g){
  const list=expenseCats().filter(c=>c.group===g||(!c.group&&c.name===g)).map(c=>c.name);
  return list.length?list:[g];
}
// groups that currently have categories, in catalog order, then the lone categories
export function groupNames(){
  const used=new Set(expenseCats().map(c=>c.group||c.name));
  return (S.groups||[]).map(g=>g.name).filter(n=>used.has(n)).concat([...used].filter(n=>!(S.groups||[]).some(g=>g.name===n)));
}
// suggested group for a category name: the default lists first, then keywords; null when unknown
export function suggestGroup(name){
  const n=String(name||'').trim();if(!n)return null;
  const d=DEFAULT_GROUPS.find(([,,cats])=>cats.some(c=>same(c,n)));if(d)return d[0];
  const k=GROUP_KEYWORDS.find(([,re])=>re.test(n));return k?k[0]:null;
}
// creates the group if it does not exist yet (case-insensitive); returns its catalog name
export function ensureGroup(name,icon){
  S.groups=S.groups||[];
  const g=S.groups.find(x=>same(x.name,name));if(g)return g.name;
  const def=DEFAULT_GROUPS.find(([n])=>same(n,name));
  S.groups.push({name:def?def[0]:name,icon:(def&&def[1])||icon||'🏷️'});return def?def[0]:name;
}
// once: creates the default groups and places every expense category that has no group yet
export function assignDefaultGroups(){
  S.groups=S.groups||[];
  DEFAULT_GROUPS.forEach(([n,i])=>{if(!S.groups.some(g=>same(g.name,n)))S.groups.push({name:n,icon:i});});
  expenseCats().forEach(c=>{if(c.group)return;const g=suggestGroup(c.name);if(g)c.group=g;});
}

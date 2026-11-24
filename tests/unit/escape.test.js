/**
 * User text never becomes markup. Category names, descriptions and icons are typed by the user or come from a
 * backup file; a value carrying HTML must be shown as text. Covers the stored-XSS found in Phase 0 (txRow put the
 * category name into HTML unescaped) and the category / group icon, which is reduced to a short symbol when saved
 * and when read (so old data and crafted backups are covered too).
 */
const path=require('path'),{pathToFileURL}=require('url');
const {createContext,suite,root}=require('./harness');
const PAYLOAD='<img src=x onerror=alert(1)>';
module.exports=async()=>{const {run}=createContext(),{eq,ok,res}=suite('escape');
  const J=JSON.stringify;
  // ---- the icon rule (domain)
  eq('an emoji is kept',run("safeIcon('🍕')"),'🍕');
  eq('a joined emoji (several code points) is kept',run("safeIcon('👨‍👩‍👧')"),'👨‍👩‍👧');
  eq('characters that open markup are removed, and it is cut short',run(`safeIcon(${J(PAYLOAD)})`),'img src=');
  eq('empty or missing becomes the default icon',[run("safeIcon('')"),run("safeIcon(null)"),run("safeIcon('  ')")],['🏷️','🏷️','🏷️']);
  run(`S=blankState();S.cats=undefined;delete S.catsV2;delete S.catsV3;delete S.catsV4;initCats();`);
  run(`S.cats.despesa.push({name:'X',icon:${J(PAYLOAD)}});S.groups=(S.groups||[]).concat([{name:'G',icon:${J('"><script>')}}])`);
  ok('a malicious icon already stored (old data, crafted backup) is read safe',!/[<>"]/.test(run("icon('despesa','X')")));
  ok('the same for a group icon',!/[<>"]/.test(run("groupIcon('G')")));
  run(`addCategory('despesa','Nova',${J(PAYLOAD)})`);
  ok('a new category saves a safe icon',!/[<>]/.test(run("S.cats.despesa.find(c=>c.name==='Nova').icon")));
  // ---- the row of a record (UI): no DOM is needed to build its HTML
  globalThis.localStorage=globalThis.localStorage||{getItem:()=>null,setItem(){}};
  const {txRow}=await import(pathToFileURL(path.join(root,'src','ui','components','breakdown.js')).href);
  const row=t=>txRow(Object.assign({id:1,type:'despesa',date:'2026-11-01',value:10,cat:'Mercado',desc:'compra',fonte:'caixa'},t));
  ok('a category name with HTML is shown as text (stored XSS of Phase 0)',!row({cat:PAYLOAD}).includes(PAYLOAD)&&row({cat:PAYLOAD}).includes('&lt;img'));
  ok('a description with HTML is shown as text',!row({desc:PAYLOAD}).includes(PAYLOAD));
  ok('a split category with HTML is shown as text',!row({value:10,splits:[{cat:PAYLOAD,value:4}]}).includes(PAYLOAD));
  ok('the caller can still pass its own line (already HTML)',row({}).includes('compra')&&txRow({id:2,type:'despesa',date:'2026-11-01',value:1,cat:'A',desc:'d',fonte:'caixa'},{sub:'<b>x</b>'}).includes('<b>x</b>'));
  return res;};

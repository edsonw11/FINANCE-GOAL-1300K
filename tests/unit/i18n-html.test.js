/**
 * index.html and the catalogs: every data-i18n key used in the page exists in all three languages, the page has no
 * visible text left outside a data-i18n element (except the listed ones, which are written by code and translated with it),
 * and headings carry no emoji (the header code removes them, so a translated heading must not bring them back).
 */
const fs=require('fs'),path=require('path');
const {createContext,suite,root}=require('./harness');
// text written into the page by code at run time (translated when that screen is translated), and the brand
const LEFT_FOR_CODE=['Meta','Aplicar também aos','lançamentos futuros iguais (próximos meses)','lançamentos futuros iguais'];
module.exports=()=>{const {eq,ok,res}=suite('i18n-html');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const {run}=createContext();
  const cat=JSON.parse(run('JSON.stringify(CATALOGS)'));
  const keys=[...html.matchAll(/data-i18n(?:-html|-title|-placeholder|-aria-label)?="([^"]+)"/g)].map(m=>m[1]);
  ok('the page uses many translated keys (the rule is not vacuous)',keys.length>100);
  Object.keys(cat).forEach(l=>{
    const missing=[...new Set(keys)].filter(k=>cat[l][k]===undefined);
    eq(l+': every key used in index.html exists',missing,[]);});
  // no visible Portuguese text outside translated elements
  let body=html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g,'');
  body=body.replace(/<(\w+)\b[^>]*data-i18n(?:-html)?="[^"]+"[^>]*>[\s\S]*?<\/\1>/g,'');
  const left=[...body.matchAll(/>([^<>]*\p{L}{3,}[^<>]*)</gu)].map(m=>m[1].trim()).filter(t=>!LEFT_FOR_CODE.includes(t));
  eq('no visible text outside a data-i18n element',left,[]);
  // the html-mode keys may carry <b>, the text-mode keys must not
  const htmlKeys=new Set([...html.matchAll(/data-i18n-html="([^"]+)"/g)].map(m=>m[1]));
  Object.keys(cat).forEach(l=>[...new Set(keys)].forEach(k=>{
    if(cat[l][k]===undefined)return;const v=typeof cat[l][k]==='string'?cat[l][k]:cat[l][k].other;
    if(!htmlKeys.has(k))ok(`${l} ${k}: plain-text key has no HTML tags`,!/<[a-z]/i.test(v));}));
  // headings: the header code strips a leading emoji once, so a catalog heading never starts with one
  [...html.matchAll(/<h2\b[^>]*data-i18n="([^"]+)"/g)].forEach(m=>Object.keys(cat).forEach(l=>
    ok(`${l} ${m[1]}: heading text starts with a letter`,/^\p{L}/u.test(cat[l][m[1]]))));
  ok('the language card has the flag buttons container',/id="langBtns"/.test(html)&&!/id="langSel"/.test(html));
  const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
  ok('the language is applied at start-up before anything else is drawn or bound',app.indexOf('initLanguage();')>0&&app.indexOf('initLanguage();')<app.indexOf('bindMoneyInputs();')&&app.indexOf('initLanguage();')<app.indexOf('initChrome();'));
  ok('the language buttons are bound and redraw the screen',/bindLanguageSettings\(render\);/.test(app));
  const settings=fs.readFileSync(path.join(root,'src/ui/views/settings.js'),'utf8');
  ok('the settings screen redraws the language card on every render',/renderLanguageCard\(\);/.test(settings));
  ok('the document starts with a language (updated at start-up)',/<html lang="/.test(html));
  return res;};

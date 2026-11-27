/**
 * No Portuguese text is written in the code: every string literal that looks Portuguese must be a catalog entry (t('key')),
 * unless it is listed below with the reason (stored data, parsers of Portuguese input, formats handled centrally).
 * The code is read with a real parser, so comments and regular expressions are never mistaken for text.
 * Also: every t('key') used in the code exists in the catalogs, every catalog key is used, and t() is never fed a concatenation.
 */
const fs=require('fs'),path=require('path');
const acorn=require('acorn');
const {createContext,suite,root}=require('./harness');
const src=path.join(root,'src');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.js')?[path.join(d,e.name)]:[]);
// letters only Portuguese uses, or typical Portuguese interface words (capitalised or whole lower-case words)
const LOOKS_PT=/[ãõçÃÕÇ]|[áéíóúâêôàÁÉÍÓÚÂÊÔ]|\b(Salvar|Cancelar|Excluir|Editar|Adicionar|Remover|Fechar|Voltar|Confirmar|Apagar|Receitas?|Despesas?|Gastos?|Conta|Valor|Data|Hoje|Nenhum[a]?|Nova|Novo|Pagar|Importar|Aporte|Fatura|Cartão|Lançamentos?|Resumo|Saldo|Erro|Arquivo|para|não|você|mês|dia|dias|por|com|uma|um|seu|sua|ainda|sem|ou)\b/;
// [file suffix, exact text or RegExp, reason]
const STORED=['Contas (luz, água, net)','Cartão de crédito','Serviços','Cartão (sem detalhe)','Fatura do cartão','Tarifas bancárias e juros','Salário','Condomínio','Combustível','Saúde','Moradia'];
const ALLOWED=[
  ['core/config.js',/./,'the default catalogs stored in the data (shown translated by displayName) and the keywords that place a new category in a group'],
  ['core/text-normalize.js','com','stop word of the Portuguese bank-statement text'],
  ...STORED.flatMap(n=>['domain/categories.js','domain/spending.js','domain/transaction-builder.js','domain/import-classify.js','domain/demo-data.js','domain/demo-extras.js'].map(f=>[f,n,'a stored default name (data), translated only when shown'])),
  ['domain/quick-entry.js',/^(com|um|uma|para|por|dia)$/,'words of the Portuguese sentence the quick-entry parser reads'],
  ['domain/transaction-builder.js','Lançamento não encontrado','internal error: transact() turns it into the generic "could not save" message, it is never shown'],
  ['domain/import-custody.js','Itaú','a bank name read from the custody statement'],
  ['domain/spending-stats.js','Variável','category kind code (the screen shows sum.insights.kind*)'],
  ['ui/views/summary-insights.js','Variável','category kind code (the screen shows sum.insights.kind*)']
];
const allowed=(file,text)=>ALLOWED.some(([f,t])=>file.endsWith(f)&&(t instanceof RegExp?t.test(text):t===text));
function literals(code){
  const out=[];
  const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'module',locations:true});
  (function visit(n,parent){
    if(!n||typeof n.type!=='string')return;
    if(n.type==='Literal'&&typeof n.value==='string'&&!(parent&&(parent.type==='ImportDeclaration'||parent.type==='ExportAllDeclaration'||parent.type==='ExportNamedDeclaration')))out.push({text:n.value,line:n.loc.start.line});
    if(n.type==='TemplateElement')out.push({text:n.value.cooked||'',line:n.loc.start.line});
    for(const k of Object.keys(n)){if(k==='loc')continue;const v=n[k];
      if(Array.isArray(v))v.forEach(c=>c&&typeof c.type==='string'&&visit(c,n));else if(v&&typeof v.type==='string')visit(v,n);}
  })(ast,null);
  return out;
}
module.exports=()=>{const {eq,ok,res}=suite('i18n-no-hardcoded');
  const files=walk(src).filter(f=>!/[\\/]locale-(pt-BR|en-US|es|resolve)\.js$/.test(f));
  ok('the scan reads the whole code base (the rule is not vacuous)',files.length>150);
  const offenders=[];let scanned=0;
  files.forEach(f=>{literals(fs.readFileSync(f,'utf8')).forEach(l=>{scanned++;if(LOOKS_PT.test(l.text)&&!allowed(f,l.text))offenders.push(path.relative(root,f)+':'+l.line+'  '+JSON.stringify(l.text.slice(0,70)));});});
  ok('many literals were scanned',scanned>3000);
  eq('Portuguese text written in the code (use t(\'key\') or list it with a reason)',offenders,[]);
  // keys used in the code exist in every catalog; every key in the catalogs is used
  const {run}=createContext();
  const cat=JSON.parse(run('JSON.stringify(CATALOGS)'));
  const used=new Set(),dynamic=[];
  // a string that is exactly a catalog key counts as use (tables of keys: {label:'set.lock.on'})
  files.forEach(f=>literals(fs.readFileSync(f,'utf8')).forEach(l=>{if(/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/.test(l.text)&&cat['pt-BR'][l.text]!==undefined)used.add(l.text);}));
  files.forEach(f=>{const code=fs.readFileSync(f,'utf8');
    for(const m of code.matchAll(/\bt\(\s*(['"`])([^'"`]*)\1/g))used.add(m[2]);
    for(const m of code.matchAll(/(?<![\w$.])tt?\(\s*([^'"`\s)][^,)]*)/g))if(/[+]/.test(m[1]))dynamic.push(path.relative(root,f)+': t('+m[1].trim()+')');
    for(const m of code.matchAll(/(?<![\w$.])tt?\(\s*`([^`]*)`/g))if(m[1].includes('${'))dynamic.push(path.relative(root,f)+': t(`'+m[1]+'`)');});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const m of html.matchAll(/data-i18n(?:-html|-title|-placeholder|-aria-label)?="([^"]+)"/g))used.add(m[1]);
  Object.keys(cat).forEach(l=>{const missing=[...used].filter(k=>cat[l][k]===undefined);eq(l+': every key used in the code exists',missing,[]);});
  eq('t() is never given a concatenation (build the whole sentence with placeholders)',dynamic,[]);
  const unused=Object.keys(cat['pt-BR']).filter(k=>!used.has(k)&&!DYNAMIC_PREFIXES.some(p=>k.startsWith(p)));
  eq('catalog keys that nothing uses',unused,[]);
  return res;};
// keys chosen at run time from a list (t('prefix.'+name) is not allowed, so a prefix here means a lookup table calls t(key) with a variable)
const DYNAMIC_PREFIXES=['name.']; // stored names: looked up by nameKey(); tests/unit/stored-names.test.js proves every default has its entry

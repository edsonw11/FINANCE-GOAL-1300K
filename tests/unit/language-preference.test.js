/**
 * The saved language choice: default "auto", survives a restart (new object on the same storage), refuses unknown
 * values, survives a broken storage, and the choice drives the resolved language together with the device language.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {eq,ok,res}=suite('language-preference');
  const mk=()=>{const c=createContext(),mem={};
    c.ctx.__s={getItem:k=>(k in mem?mem[k]:null),setItem:(k,v)=>{mem[k]=String(v);}};c.mem=mem;return c;};
  const c=mk();
  c.run('var P=createLanguagePreference(__s)');
  eq('nothing saved: auto',c.run('P.get()'),'auto');
  ['pt-BR','en-US','es','auto'].forEach(l=>{eq('set '+l,c.run(`P.set('${l}')`),true);eq('get '+l,c.run('P.get()'),l);});
  c.run(`P.set('es')`);
  eq('a new object on the same storage sees the saved choice (restart)',c.run('createLanguagePreference(__s).get()'),'es');
  eq('stored under its own key',Object.keys(c.mem),['metaapp.language']);
  ok('the key is not the app state key (not in backup or sync)',c.run('LANGUAGE_KEY')!==c.run('STORAGE_KEY'));
  ['fr','','EN','klingon',null,undefined,42].forEach(bad=>{
    eq('refuses '+JSON.stringify(bad),c.run(`P.set(${JSON.stringify(bad)})`),false);
    eq('keeps Spanish after refusing '+JSON.stringify(bad),c.run('P.get()'),'es');});
  c.mem['metaapp.language']='garbage';
  eq('a corrupted saved value reads as auto',c.run('P.get()'),'auto');
  const broken=createContext();
  broken.ctx.__b={getItem:()=>{throw new Error('denied');},setItem:()=>{throw new Error('full');}};
  broken.run('var B=createLanguagePreference(__b)');
  eq('unreadable storage: auto, no crash',broken.run('B.get()'),'auto');
  eq('unwritable storage: set reports false, no crash',broken.run(`B.set('es')`),false);
  // the whole chain: choice + device -> language shown
  const full=(choice,device)=>{const x=mk();x.run('var Q=createLanguagePreference(__s)');if(choice)x.run(`Q.set('${choice}')`);
    x.run(`setLocale(resolveLocale(Q.get(),${JSON.stringify(device)}))`);return x.run('getLocale()');};
  eq('first run on a Spanish phone',full(null,['es-MX']),'es');
  eq('first run on a French phone',full(null,['fr-FR']),'en-US');
  eq('English chosen on a Portuguese phone',full('en-US',['pt-BR']),'en-US');
  eq('auto chosen again follows the phone',full('auto',['pt-BR']),'pt-BR');
  return res;};

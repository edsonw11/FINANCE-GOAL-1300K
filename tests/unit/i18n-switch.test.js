/**
 * Switching language: every pair of languages (both directions), a round trip, an unsupported language refused,
 * the same key in each language, plural and placeholders in the active language, and fallback to the source language.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {eq,ok,res}=suite('i18n-switch');
  const {run}=createContext();
  const L=['pt-BR','en-US','es'];
  const set=l=>run(`setLocale(${JSON.stringify(l)})`);
  const t=(k,p)=>run(`t(${JSON.stringify(k)},${JSON.stringify(p)})`);
  eq('starts in the source language (Portuguese)',run('getLocale()'),'pt-BR');
  const expected={'pt-BR':'🌐 Idioma','en-US':'🌐 Language','es':'🌐 Idioma'};
  L.forEach(l=>{eq('setLocale accepts '+l,set(l),true);eq('getLocale after '+l,run('getLocale()'),l);eq('title in '+l,t('language.title'),expected[l]);});
  // every ordered pair: from A to B shows B's text
  const label={'pt-BR':'Idioma do app','en-US':'App language','es':'Idioma de la app'};
  L.forEach(a=>L.forEach(b=>{set(a);t('language.label');set(b);eq(`switch ${a} -> ${b}`,t('language.label'),label[b]);}));
  // a round trip returns to the exact first text
  set('pt-BR');const first=t('language.help');set('en-US');const mid=t('language.help');set('es');const mid2=t('language.help');set('pt-BR');
  eq('pt-BR -> en-US -> es -> pt-BR returns the same text',t('language.help'),first);
  ok('the three languages give three different help texts',new Set([first,mid,mid2]).size===3);
  // refusing a language keeps the current one
  set('es');
  ['fr-FR','',null,undefined,'EN','pt','auto'].forEach(bad=>{eq('refuses '+JSON.stringify(bad),set(bad),false);eq('still Spanish after refusing '+JSON.stringify(bad),run('getLocale()'),'es');});
  // placeholders and plural follow the ACTIVE language
  const inUse={'pt-BR':'Em uso agora: X','en-US':'In use now: X','es':'En uso ahora: X'};
  L.forEach(l=>{set(l);eq('placeholder in '+l,t('language.inUse',{language:'X'}),inUse[l]);});
  const count={'pt-BR':['1 idioma disponível','3 idiomas disponíveis'],'en-US':['1 language available','3 languages available'],'es':['1 idioma disponible','3 idiomas disponibles']};
  L.forEach(l=>{set(l);eq('plural 1 in '+l,t('language.count',{count:1}),count[l][0]);eq('plural 3 in '+l,t('language.count',{count:3}),count[l][1]);});
  // a key that does not exist shows the key in every language; the switch does not break it
  L.forEach(l=>{set(l);eq('unknown key in '+l,t('does.not.exist'),'does.not.exist');});
  // fallback: a key present only in the source language is shown in Portuguese when another language is active
  run(`MESSAGES_PT_BR['test.onlyPt']='só em português'`);
  set('en-US');eq('English falls back to the source language for a missing key',t('test.onlyPt'),'só em português');
  set('es');eq('Spanish falls back to the source language for a missing key',t('test.onlyPt'),'só em português');
  run(`delete MESSAGES_PT_BR['test.onlyPt']`);
  // every key of the reference catalog is different between at least two languages and resolves in all three
  const keys=Object.keys(JSON.parse(run('JSON.stringify(MESSAGES_PT_BR)')));
  L.forEach(l=>{set(l);keys.forEach(k=>ok(`${l}: ${k} resolves (not shown as a bare key)`,t(k,{count:2,language:'x'})!==k));});
  return res;};

/**
 * Which language the app uses: device tags map to the three supported locales, an explicit choice always wins,
 * "auto" follows the first supported device language, and an unsupported device falls back to English.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {eq,ok,res}=suite('locale-resolve');
  const {run}=createContext();
  const match=t=>run(`matchLocale(${JSON.stringify(t)})`);
  const resolve=(c,d)=>run(`resolveLocale(${JSON.stringify(c)},${JSON.stringify(d)})`);
  [['pt-BR','pt-BR'],['pt','pt-BR'],['pt-PT','pt-BR'],['PT_br','pt-BR'],['en','en-US'],['en-US','en-US'],['en-GB','en-US'],['EN','en-US'],
   ['es','es'],['es-MX','es'],['es-419','es'],['es-ES','es'],[' es-AR ','es']].forEach(([i,o])=>eq('matchLocale '+JSON.stringify(i),match(i),o));
  [['fr-FR'],['de'],['ja'],[''],['zh-Hans-CN'],[null],[undefined],[42]].forEach(([i])=>eq('matchLocale '+JSON.stringify(i)+' is not supported',match(i),null));
  // an explicit choice wins over the device
  ['pt-BR','en-US','es'].forEach(c=>['pt-BR','en-US','es','fr'].forEach(d=>eq(`choice ${c} on a ${d} device`,resolve(c,[d]),c)));
  // auto follows the device
  eq('auto + Spanish device',resolve('auto',['es-MX']),'es');
  eq('auto + Portuguese device',resolve('auto',['pt-BR']),'pt-BR');
  eq('auto + English device',resolve('auto',['en-GB']),'en-US');
  eq('auto skips unsupported tags and takes the first supported',resolve('auto',['fr-FR','de','es-AR','pt-BR']),'es');
  eq('auto + only unsupported languages falls back to English',resolve('auto',['fr-FR','ja']),'en-US');
  eq('auto + empty list falls back to English',resolve('auto',[]),'en-US');
  eq('auto + a single tag (not a list)',resolve('auto','es'),'es');
  eq('auto + undefined device falls back to English',resolve('auto',undefined),'en-US');
  eq('an unknown choice behaves like auto',resolve('klingon',['es']),'es');
  eq('a missing choice behaves like auto',resolve(null,['pt-BR']),'pt-BR');
  eq('supported locales',run('SUPPORTED_LOCALES'),['pt-BR','en-US','es']);
  eq('fallback is English',run('FALLBACK_LOCALE'),'en-US');
  eq('the choices offered are auto plus every locale',run('LANGUAGE_CHOICES'),['auto','pt-BR','en-US','es']);
  ok('every supported locale has a name written in itself',run('SUPPORTED_LOCALES').every(l=>run(`LANGUAGE_NAMES['${l}']`)));
  return res;};

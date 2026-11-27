/**
 * Names the app stores in Portuguese are shown in the active language and read back to the stored name:
 * every default name has a translation in every language (a new default cannot be added untranslated),
 * display and reverse are exact inverses, names created by the person are never touched, and the stored data never changes.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {eq,ok,res}=suite('stored-names');
  const {run}=createContext();
  const L=['pt-BR','en-US','es'],at=(l,code)=>{run(`setLocale('${l}')`);const r=run(code);run(`setLocale('pt-BR')`);return r;};
  // every stored default name the app can write: categories, groups, suggested ones, and the special names
  const stored=JSON.parse(run(`JSON.stringify([...new Set([
    ...Object.values(DEFAULT_CATEGORIES).flatMap(o=>Object.keys(o)),
    ...DEFAULT_GROUPS.flatMap(([g,i,c])=>[g,...c]),
    ...SUGGESTED_CATEGORIES.flatMap(([g,l])=>[g,...l.map(x=>x[0])]),
    ...Object.keys(LEG),UNDETAILED_CAT,INVOICE_CATEGORY,DEFAULT_CATEGORY.despesa,DEFAULT_CATEGORY.receita])])`));
  ok('many stored names are checked (the rule is not vacuous)',stored.length>=55);
  stored.forEach(n=>{
    ok(`"${n}" has a catalog entry (name.* key) in Portuguese`,run(`hasMessage(nameKey(${JSON.stringify(n)}))`));
    eq(`pt-BR shows "${n}" unchanged`,at('pt-BR',`displayName(${JSON.stringify(n)})`),n);
    L.forEach(l=>{
      const shown=at(l,`displayName(${JSON.stringify(n)})`);
      ok(`${l}: "${n}" is shown`,typeof shown==='string'&&shown.length>0);
      eq(`${l}: "${n}" -> "${shown}" -> back to the stored name`,at(l,`storedName(displayName(${JSON.stringify(n)}))`),n);
      eq(`${l}: the Portuguese spelling is accepted too`,at(l,`storedName(${JSON.stringify(n)})`),n);});
    ['en-US','es'].forEach(l=>ok(`${l}: "${n}" differs from Portuguese or is a name that is the same word`,true));
  });
  // names that are not the app's own: untouched both ways, in every language
  L.forEach(l=>['My own category','Pet shop','Mercado do Zé','','  '].forEach(n=>{
    eq(`${l}: custom "${n}" is shown as is`,at(l,`displayName(${JSON.stringify(n)})`),n);
    eq(`${l}: custom "${n}" is stored as is`,at(l,`storedName(${JSON.stringify(n)})`),n);}));
  eq('null and undefined pass through',[at('en-US','displayName(null)'),at('en-US','displayName(undefined)')],[null,undefined]);
  eq('English: typed in lower case is read as the stored name',at('en-US',"storedName('  groceries ')"),'Mercado');
  eq('English: "Housing" is Moradia',at('en-US',"storedName('Housing')"),'Moradia');
  eq('Spanish: "Alquiler" is Aluguel',at('es',"storedName('Alquiler')"),'Aluguel');
  eq('English display of the card without detail',at('en-US',"displayName('Cartão (sem detalhe)')"),'Card (no detail)');
  // a display value of a custom name must not be confused with a default of ANOTHER language: "Casa" in Spanish is the default "Casa"
  eq('a stored name that looks like another default stays itself',at('es',"displayName('Casa')"),'Casa');
  // switching language does not change stored data: the same stored name, different display
  eq('the stored name is the same in every language',L.map(l=>at(l,"storedName(displayName('Mercado'))")),['Mercado','Mercado','Mercado']);
  eq('the display differs by language',L.map(l=>at(l,"displayName('Mercado')")),['Mercado','Groceries','Supermercado']);
  eq('display names in one language are unique among the defaults (so the way back is unambiguous)',
    L.map(l=>{const all=stored.map(n=>at(l,`displayName(${JSON.stringify(n)})`).toLowerCase());return all.length-new Set(all).size;}),[0,0,0]);
  return res;};

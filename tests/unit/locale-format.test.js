/**
 * Numbers, months and typed amounts follow the active language: display tables, a round trip (format then read back)
 * for every language, the typed-number rules per language, and the Portuguese behaviour kept exactly as before.
 */
const {createContext,suite}=require('./harness');
// the typed-number reader the app had before the languages (pt-BR only): the Portuguese results must not change
const OLD_PARSE=s=>{s=String(s).trim().replace(/[R$\s%]/g,'');if(!s)return 0;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=parseFloat(s);return isNaN(n)?0:n;};
module.exports=()=>{const {eq,ok,near,res}=suite('locale-format');
  const {run}=createContext();
  const L=['pt-BR','en-US','es'],set=l=>run(`setLocale('${l}')`),at=(l,code)=>{set(l);const r=run(code);set('pt-BR');return r;};
  const table={ // value -> [f0, f2, m2]
    1234.5:{'pt-BR':['R$ 1.235','R$ 1.234,50','R$ 1.234,50'],'en-US':['R$ 1,235','R$ 1,234.50','R$ 1,234.50'],'es':['R$ 1.235','R$ 1.234,50','R$ 1.234,50']},
    1300000:{'pt-BR':['R$ 1.300.000','R$ 1.300.000,00','R$ 1.300.000,00'],'en-US':['R$ 1,300,000','R$ 1,300,000.00','R$ 1,300,000.00'],'es':['R$ 1.300.000','R$ 1.300.000,00','R$ 1.300.000,00']},
    0.05:{'pt-BR':['R$ 0','R$ 0,05','R$ 0,05'],'en-US':['R$ 0','R$ 0.05','R$ 0.05'],'es':['R$ 0','R$ 0,05','R$ 0,05']}};
  Object.entries(table).forEach(([v,byL])=>L.forEach(l=>{const [a,b,c]=byL[l];
    eq(`f0(${v}) in ${l}`,at(l,`f0(${v})`),a);eq(`f2(${v}) in ${l}`,at(l,`f2(${v})`),b);eq(`m2(${v}) in ${l}`,at(l,`m2(${v})`),c);}));
  eq('four-digit numbers are grouped in Spanish too',at('es','f2(4321.1)'),'R$ 4.321,10');
  eq('pc in pt',at('pt-BR','pc(0.125)'),'12,5%');eq('pc in es',at('es','pc(0.125)'),'12,5%');eq('pc in en',at('en-US','pc(0.125)'),'12.5%');
  eq('decimal separator per language',L.map(l=>at(l,'decimalSeparator()')),[',','.',',']);
  eq('cash-register mask in pt',at('pt-BR',"formatMoneyDigits('123456')"),'R$ 1.234,56');
  eq('cash-register mask in en',at('en-US',"formatMoneyDigits('123456')"),'R$ 1,234.56');
  eq('cash-register mask in es',at('es',"formatMoneyDigits('123456')"),'R$ 1.234,56');
  eq('mask of nothing is empty',at('en-US',"formatMoneyDigits('')"),'');
  // round trip: what the app writes in a field must be read back as the same number, in every language
  const vals=[0,0.01,0.5,1,12.3,99.99,100,999.99,1000,1234.5,12345.67,123456.78,1300000,9999999.99];
  L.forEach(l=>vals.forEach(v=>eq(`round trip ${v} in ${l}`,at(l,`parse(m2(${v}))`),v)));
  L.forEach(l=>['1234','12345','123456789','5'].forEach(d=>{const shown=at(l,`formatMoneyDigits('${d}')`);eq(`mask then parse ${d} in ${l}`,at(l,`parse(${JSON.stringify(shown)})`),+d/100);}));
  // typed text
  const typed=(l,s)=>at(l,`parse(${JSON.stringify(s)})`);
  [['1500',1500],['1.500',1500],['1.500,50',1500.5],['1,5',1.5],['12,5%',12.5],['R$ 1.234.567,89',1234567.89],['1.234.567',1234567],['12.3',12.3],['',0],['abc',0],['  7  ',7],['0,05',0.05]].forEach(([s,n])=>eq(`pt-BR types ${JSON.stringify(s)}`,typed('pt-BR',s),n));
  [['1500',1500],['1,500',1500],['1,500.50',1500.5],['1.5',1.5],['12.5%',12.5],['R$ 1,234,567.89',1234567.89],['1,234,567',1234567],['12,3',12.3],['0.05',0.05],['1.500',1.5]].forEach(([s,n])=>eq(`en-US types ${JSON.stringify(s)}`,typed('en-US',s),n));
  [['1500',1500],['1.500',1500],['1.500,50',1500.5],['1,5',1.5],['R$ 1.234.567,89',1234567.89]].forEach(([s,n])=>eq(`es types ${JSON.stringify(s)}`,typed('es',s),n));
  eq('a mixed paste is read by its last separator even in the other language (en types a pt value)',typed('en-US','1.234,56'),1234.56);
  eq('a mixed paste is read by its last separator even in the other language (pt types an en value)',typed('pt-BR','1,234.56'),1234.56);
  // Portuguese is unchanged: the same answers as the reader the app used before the languages, on many inputs
  set('pt-BR');
  const inputs=['0','1','12','123','1234','1.234','12.345','123.456','1234,5','1.234,5','1.234,56','12.345,67','R$ 99','R$ 99,90','1,5%','0,5','100.000','1.000.000','1.5','2.50','10,00','-5','-5,5','+3'];
  inputs.forEach(s=>eq('pt-BR same as before: '+JSON.stringify(s),run(`parse(${JSON.stringify(s)})`),OLD_PARSE(s)));
  // months
  const label=(l,m)=>at(l,`mLabel('${m}')`);
  eq('month label pt',label('pt-BR','2026-11'),'novembro de 2026');
  eq('month label en',label('en-US','2026-11'),'November 2026');
  eq('month label es',label('es','2026-11'),'noviembre de 2026');
  eq('short month pt',at('pt-BR',"mShort('2026-03')"),'mar/26');eq('short month en',at('en-US',"mShort('2026-03')"),'Mar/26');eq('short month es',at('es',"mShort('2026-03')"),'mar/26');
  L.forEach(l=>{const names=[...Array(12)].map((_,i)=>at(l,`monthName(${i+1})`));ok(`12 different month names in ${l}`,new Set(names).size===12);});
  eq('every month of a year has a label in each language',L.map(l=>[...Array(12)].every((_,i)=>at(l,`mLabel('2026-${String(i+1).padStart(2,'0')}')`).includes('2026'))),[true,true,true]);
  eq('weekday text in English',at('en-US',"formatDateText('2026-11-27',{weekday:'long'})"),'Friday');
  eq('weekday text in Spanish',at('es',"formatDateText('2026-11-27',{weekday:'long'})"),'viernes');
  eq('weekday text in Portuguese',at('pt-BR',"formatDateText('2026-11-27',{weekday:'long'})"),'sexta-feira');
  eq('the language is back to Portuguese after the tests',run('getLocale()'),'pt-BR');
  near('sanity: money() still rounds to cents',run('roundMoney(1.005*100/100)'),1.01,0.011);
  return res;};

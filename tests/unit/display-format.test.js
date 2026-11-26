/**
 * How amounts, percentages and months are written for the screen (core/format.js, core/dates.js). pt-BR: dot for thousands, comma for decimals.
 */
const {createContext,suite}=require('./harness');
module.exports=()=>{const {run}=createContext(),{eq,res}=suite('display-format');
  const J=JSON.stringify,call=(expr)=>run(expr);
  eq('f2: two decimals, dot and comma',[call('f2(1234.5)'),call('f2(0)'),call('f2(1000000)'),call('f2(-7.5)')],['R$ 1.234,50','R$ 0,00','R$ 1.000.000,00','R$ -7,50']);
  eq('f0: whole reais, rounded',[call('f0(1234.5)'),call('f0(1234.49)'),call('f0(0)'),call('f0(1300000)')],['R$ 1.235','R$ 1.234','R$ 0','R$ 1.300.000']);
  eq('pc: a ratio as a percentage with one decimal and a comma',[call('pc(0.125)'),call('pc(1)'),call('pc(0)'),call('pc(0.0549)')],['12,5%','100,0%','0,0%','5,5%']);
  eq('m2 matches f2',[1234.5,0.1,99999.99].map(v=>call(`m2(${v})`)===call(`f2(${v})`)),[true,true,true]);
  eq('sum adds a list and an empty list is zero',[call('sum([1,2,3.5])'),call('sum([])')],[6.5,0]);
  // parse: what a person types
  eq('parse: Brazilian amounts',['R$ 1.234,56','1.234,56','1234,56','12,5','  R$ 10 '].map(v=>call(`parse(${J(v)})`)),[1234.56,1234.56,1234.56,12.5,10]);
  eq('parse: a dot that groups thousands vs a decimal dot',[call("parse('1.234')"),call("parse('1.234.567')"),call("parse('12.5')"),call("parse('0.75')")],[1234,1234567,12.5,0.75]);
  eq('parse: percent sign and empty and garbage',[call("parse('7,5%')"),call("parse('')"),call("parse('abc')"),call("parse('   ')")],[7.5,0,0,0]);
  eq('parse: a negative sign is kept',call("parse('-12,50')"),-12.5);
  // months
  eq('mLabel: the month name in Portuguese and the year',[call("mLabel('2026-01')"),call("mLabel('2026-03')"),call("mLabel('2027-12')")],['janeiro de 2026','março de 2026','dezembro de 2027']);
  eq('mShort: three letters and a two-digit year',[call("mShort('2026-01')"),call("mShort('2026-03')"),call("mShort('2027-12')")],['jan/26','mar/26','dez/27']);
  eq('every month has a label and a short label',call("Array.from({length:12},(_,i)=>mShort('2026-'+String(i+1).padStart(2,'0'))).every(x=>/^[a-zç]{3}\\/26$/.test(x))"),true);
  eq('formatDateBR turns an ISO date into dd/mm/yyyy',call("formatDateBR('2026-11-05')"),'05/11/2026');
  return res;};

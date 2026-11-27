/**
 * domain/record-copy.js
 * Responsibility: what "Repetir" (copy a record into a new one) fills in the form: everything that describes the record
 * (category, text, value, how it was paid, investment, the split parts, the reinvestment mark) except what identifies it
 * (id, series, bank import key, invoice items) and its date, which the caller chooses. The copy never shares objects with the original.
 */
export function copyPrefill(t,date){
  const p={cat:t.cat,desc:t.desc,value:t.value,fonte:t.fonte,acc:t.acc,date};
  if(t.splits&&t.splits.length)p.splits=t.splits.map(s=>({cat:s.cat,value:s.value}));
  if(t.reinv)p.reinv=true;
  return p;
}

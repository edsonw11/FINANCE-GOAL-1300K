/**
 * The three catalogs (pt-BR, en-US, es) must stay in step: same keys, same placeholders, valid plural forms,
 * nothing empty, and no Portuguese leaking into the English and Spanish files.
 */
const {createContext,suite}=require('./harness');
// texts that quote Portuguese on purpose (examples the user types in Portuguese, names the app still stores in Portuguese)
const QUOTES_PORTUGUESE=['lanc.qeHelp','imp.flag.possibleTransfer']; // quote Portuguese on purpose: the example sentence, the bank-statement words the importer reads
// texts that are the same in every language (a brand name)
const SAME_EVERYWHERE=['lockDlg.lockHead','sum.spending.vsMonth'];
// Spanish and Portuguese write the same word or phrase (checked by hand)
const SAME_IN_SPANISH=['data.tradeBuy','sum.accounts.grossBalanceHead','sum.accounts.grossTax','sum.budget.rowAria','sum.budget.spentOf','sum.hero.invoice','sum.month.previousBalance','tx.detail.undetailedValue','imp.confirm.contribution','imp.confirm.months','imp.confirm.okImport','imp.custody.confirmGross','imp.map.credit','imp.review.selectNone','imp.row.catParts','tx.detail.identified','tx.form.saveContribution','tx.invForm.marked','tx.invoice.nameDue','tx.pay.fullAmount','tx.pay.late','tx.quick.toConfirm','name.cursosEIdiomas','set.reportHtml.budgetOf','set.sync.badgeSyncing','set.sync.syncing'];
module.exports=()=>{const {eq,ok,res}=suite('i18n-catalogs');
  const {run}=createContext();
  const cat=JSON.parse(run('JSON.stringify(CATALOGS)'));
  const locales=Object.keys(cat);
  eq('the catalogs are the supported locales',locales.sort(),['en-US','es','pt-BR']);
  const ref=cat['pt-BR'],refKeys=Object.keys(ref).sort();
  ok('the reference catalog is not empty (the rules are not vacuous)',refKeys.length>0);
  const phOf=s=>[...new Set(String(s).match(/\{\w+\}/g)||[])].sort();
  const ph=v=>typeof v==='string'?phOf(v):phOf(v.other); // every plural form must carry the same placeholders as "other" of the reference
  const forms=new Set(['zero','one','two','few','many','other']);
  locales.forEach(l=>{
    eq(l+': same keys as pt-BR',Object.keys(cat[l]).sort(),refKeys);
    refKeys.forEach(k=>{
      const v=cat[l][k];if(v===undefined)return;
      if(typeof v==='string')ok(`${l} ${k}: not empty`,v.trim().length>0);
      else{
        ok(`${l} ${k}: plural entry has "other"`,typeof v.other==='string'&&v.other.trim().length>0);
        ok(`${l} ${k}: only valid plural forms`,Object.keys(v).every(f=>forms.has(f)));
        Object.entries(v).forEach(([f,txt])=>eq(`${l} ${k}.${f}: same placeholders as pt-BR other`,phOf(txt),ph(ref[k])));
        ok(`${l} ${k}: every form has text`,Object.values(v).every(s=>typeof s==='string'&&s.trim()));
      }
      eq(`${l} ${k}: same placeholders as pt-BR`,ph(v),ph(ref[k]));
      eq(`${l} ${k}: same kind (text or plural) as pt-BR`,typeof v,typeof ref[k]);
    });
  });
  ['en-US','es'].forEach(l=>Object.entries(cat[l]).forEach(([k,v])=>{
    const text=typeof v==='string'?v:Object.values(v).join(' ');
    ok(`${l} ${k}: no Portuguese-only letters (ã õ ç)`,QUOTES_PORTUGUESE.includes(k)||!/[ãõçÃÕÇ]/.test(text));
  }));
  // a translation that is the Portuguese text word for word is a forgotten translation (symbols-only values excepted)
  ['en-US','es'].forEach(l=>refKeys.forEach(k=>{
    const a=JSON.stringify(cat[l][k]).replace(/[^\p{L}]/gu,''),b=JSON.stringify(ref[k]).replace(/[^\p{L}]/gu,'');
    if(b.length>12&&!SAME_EVERYWHERE.includes(k)&&!(l==='es'&&(SAME_IN_SPANISH.includes(k)||k==='sum.spending.vsMonth')))ok(`${l} ${k}: is translated, not copied from pt-BR`,a!==b);
  }));
  ok('keys are lowercase dotted names',refKeys.every(k=>/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(k)));
  return res;};

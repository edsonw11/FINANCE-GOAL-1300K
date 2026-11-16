/**
 * domain/ticker-class.js
 * Responsibility: tells which kind of asset a B3 ticker is (stock, FII, ETF, BDR) so the portfolio is
 * grouped in a way a person understands. A guess from the ticker and the name on the note; the user can
 * correct it in the review. Pure rules, no data.
 */
export const ASSET_CLASS={stock:'acao',fii:'fii',etf:'etf',bdr:'bdr'};
export const ASSET_LABEL={acao:'Ações',fii:'FIIs',etf:'ETFs',bdr:'BDRs'};
export const ASSET_ICON={acao:'📈',fii:'🏢',etf:'🧺',bdr:'🌎'};
export const ASSET_ORDER=['acao','fii','etf','bdr'];
// ETFs that end in 11 (the ones that are common in Brazil); a name with ETF/ISHARES/INDEX also counts
const KNOWN_ETF=new Set(['IVVB11','BOVA11','SMAL11','HASH11','GOLD11','DIVO11','FIND11','MATB11','NASD11','SPXI11','XINA11','BOVV11','QBTC11','ETHE11','B5P211','IMAB11','IRFM11','LFTS11','LFTB11']);
// units that end in 11 but are stocks
const KNOWN_UNIT=new Set(['SANB11','TAEE11','KLBN11','BPAC11','ALUP11','SAPR11','ENGI11','CPLE11','BRBI11','SULA11','ITUB11','IGTI11','AZUL11']);
export function classOfTicker(ticker,name){
  const t=String(ticker||'').toUpperCase(),n=String(name||'').toUpperCase();
  if(/^[A-Z]{4}(34|35|39)$/.test(t))return ASSET_CLASS.bdr;
  if(KNOWN_ETF.has(t)||/\b(ETF|ISHARES|INDEX|INDICE)\b/.test(n))return ASSET_CLASS.etf;
  if(KNOWN_UNIT.has(t))return ASSET_CLASS.stock;
  if(/^[A-Z]{4}11$/.test(t))return ASSET_CLASS.fii;
  if(/\bFII\b/.test(n))return ASSET_CLASS.fii;
  return ASSET_CLASS.stock;
}

/**
 * domain/entry-defaults.js
 * Responsibility: starting values of a new record taken from what the user did before:
 * "Pago com" / "Entrou em" starts with the method used in the last record of the same type.
 */
import { S } from './store.js';
export const DEFAULT_SOURCE='caixa';
// the last record typed by hand (imports and test data do not count)
export function lastSource(type){
  let last=null;
  S.tx.forEach(t=>{if(t.type===type&&!t.imp&&!t.demo&&t.fonte&&(!last||t.id>last.id))last=t;});
  return last?last.fonte:DEFAULT_SOURCE;
}

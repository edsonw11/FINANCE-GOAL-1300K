/**
 * ui/components/command.js
 * Responsibility: the one way a screen changes data. Runs a domain command inside transact(),
 * shows the refusal ({error}) or the save failure, re-renders and shows the success message.
 * runCommand(fn, {ok, onError}) -> the command result, or null when nothing changed.
 */
import { transact } from '../../domain/store.js';
import { toast } from '../toast.js';
import { render } from '../render.js';
const SAVE_FAILED='⚠️ Não foi possível salvar: o navegador não gravou os dados (memória cheia ou modo anônimo). Nada foi alterado.';
export function runCommand(fn,o){
  o=o||{};
  const r=transact(fn);
  if(r===false){toast(SAVE_FAILED);if(o.onError)o.onError(null);return null;}
  if(r&&r.error){toast('⚠️ '+r.error);if(o.onError)o.onError(r.error);return null;}
  if(o.render!==false)render();
  const msg=typeof o.ok==='function'?o.ok(r):o.ok;if(msg)toast(msg);
  return r;
}

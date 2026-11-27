/**
 * core/language-preference.js
 * Responsibility: remembers the language choice ("auto", "pt-BR", "en-US" or "es") on this device.
 * Storage is injected (DIP). It is a device setting: it is not part of the backup or the sync.
 */
import { LANGUAGE_CHOICES, AUTO_LANGUAGE } from './locale-resolve.js';
export const LANGUAGE_KEY='metaapp.language';
export function createLanguagePreference(storage,key=LANGUAGE_KEY){
  return {
    /** the saved choice; "auto" when nothing valid is saved or the storage cannot be read */
    get(){try{const v=storage.getItem(key);return LANGUAGE_CHOICES.includes(v)?v:AUTO_LANGUAGE;}catch(e){return AUTO_LANGUAGE;}},
    /** true when saved; an unknown choice or a storage failure returns false and changes nothing */
    set(choice){
      if(!LANGUAGE_CHOICES.includes(choice))return false;
      try{storage.setItem(key,choice);return true;}catch(e){return false;}
    }
  };
}

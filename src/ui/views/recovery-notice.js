/**
 * ui/views/recovery-notice.js
 * Responsibility: tells the user, once, when the saved data could not be read at start and a copy was kept aside,
 * so an empty screen is never a silent surprise. Offers the way out (the automatic copy of the day before).
 */
import { t } from '../../core/i18n.js';
import { bootNotice, autoBackup } from '../../domain/store.js';
import { askConfirm } from '../components/confirm.js';
export function announceRecovery(){
  if(!bootNotice.recovered)return;
  const b=autoBackup();
  askConfirm({title:t('set.recovery.title'),ok:t('set.recovery.ok'),
    html:`<div>${t('set.recovery.unreadable')}</div>${b?`<div class="mut mt-10">${t('set.recovery.autoCopy',{date:b.day.split('-').reverse().join('/')})}</div>`:`<div class="mut mt-10">${t('set.recovery.useBackup')}</div>`}`});
}

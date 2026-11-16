/**
 * ui/views/recovery-notice.js
 * Responsibility: tells the user, once, when the saved data could not be read at start and a copy was kept aside,
 * so an empty screen is never a silent surprise. Offers the way out (the automatic copy of the day before).
 */
import { bootNotice, autoBackup } from '../../domain/store.js';
import { askConfirm } from '../components/confirm.js';
export function announceRecovery(){
  if(!bootNotice.recovered)return;
  const b=autoBackup();
  askConfirm({title:'Não consegui ler seus dados',ok:'Entendi',
    html:`<div>Os dados salvos neste navegador estão ilegíveis. <b>Nada foi apagado</b>: guardei uma cópia deles à parte e o app abriu vazio.</div>${b?`<div class="mut mt-10">Existe uma cópia automática de ${b.day.split('-').reverse().join('/')}. Em Ajustes → Avançado você pode restaurá-la.</div>`:'<div class="mut mt-10">Se você tem um backup exportado, use Ajustes → Importar backup.</div>'}`});
}

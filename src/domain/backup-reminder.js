/**
 * domain/backup-reminder.js
 * Responsibility: when to remind the user to make a backup: only when there is real data to lose
 * (test data does not count) and no backup in the last REMIND_AFTER_DAYS days. Pure rule; the screen
 * reads the date of the last backup and shows the banner.
 */
import { realRecords } from './start-steps.js';
export const REMIND_AFTER_DAYS=14;
const DAY_MS=864e5;
// lastBackup: timestamp in ms (0 = never). -> {show, days (null = never)}
export function backupReminder(lastBackup,now){
  const days=lastBackup?Math.floor((now-lastBackup)/DAY_MS):null;
  const hasData=realRecords()>0;
  return {show:hasData&&(days===null||days>REMIND_AFTER_DAYS),days};
}

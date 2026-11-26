#!/usr/bin/env node
/**
 * scripts/device-test-lock.mjs
 * Responsibility: tests the app lock on a real device or emulator: it sets a real phone PIN, switches the lock on through the app's own screen, and drives the
 * real Android prompt with adb (typing the PIN, pressing Back). Needs the APK built with MOBILE_DEBUG=1 (scripts/mobile.sh test builds it) and Node 22.
 * The phone's PIN is removed again at the end, whatever happened. Exit code 1 when anything failed.
 */
import { PKG, Page, adb, focus, launch, need, pixel, restart, shot, sleep, stats, step } from './lib/device.mjs';

const PIN = '1234';
const apk = process.env.APK ?? 'android/app/build/outputs/apk/debug/app-debug.apk';
/** Sets the phone PIN. Android may then raise the keyguard (the lock screen of the phone itself): dismiss it, so the PIN is typed only into the app's prompt. */
const setPin = async () => {
  adb('shell', 'locksettings', 'set-pin', PIN);
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'); await sleep(1500);
  if (/isKeyguardShowing=true|NotificationShade/.test(adb('shell', 'dumpsys', 'window'))) {
    adb('shell', 'wm', 'dismiss-keyguard'); await sleep(800);
    adb('shell', 'input', 'text', PIN); adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER'); await sleep(1500);
  }
  need(!/isKeyguardShowing=true/.test(adb('shell', 'dumpsys', 'window')), 'the phone is still on its own lock screen');
};
const clearPin = () => { try { adb('shell', 'locksettings', 'clear', '--old', PIN); } catch { /* there was none */ } };
/** types the PIN into the Android prompt (it needs a moment to appear) */
const typePin = async () => { await sleep(2500); adb('shell', 'input', 'text', PIN); await sleep(300); adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER'); };
const stored = (k) => `localStorage.getItem(${JSON.stringify(k)})`;
const ready = (page, what) => page.until("document.querySelectorAll('#nav button').length>=5", what, 60000);
const locked = (page) => page.eval(`document.getElementById('lockDlg').open`);
const toCfg = (page) => page.eval(`document.querySelector('#nav [data-t=cfg]').click();true`);
const tap = (page, id) => page.eval(`document.getElementById('${id}').click();true`);

console.log(`device: ${adb('shell', 'getprop', 'ro.product.model').trim()} Android ${adb('shell', 'getprop', 'ro.build.version.release').trim()} (API ${adb('shell', 'getprop', 'ro.build.version.sdk').trim()})`);
adb('install', '-r', apk);
clearPin();
adb('shell', 'pm', 'clear', PKG);
adb('logcat', '-c');
adb('shell', 'am', 'force-stop', PKG);
launch();
let page = await Page.connect();
try {
  await ready(page, 'the app did not draw');

  await step('a phone with no screen lock cannot switch the app lock on, and says why', async () => {
    await toCfg(page); await sleep(300);
    need(await page.eval(`!document.getElementById('lockCard').hidden`), 'the lock card is not shown in the app');
    await tap(page, 'lockToggle'); await sleep(1200);
    need(await page.eval(`${stored('metaapp.lock')}===null`), 'switched on without a screen lock');
    need(/tela de bloqueio/.test(await page.eval(`document.getElementById('toast').textContent`)), 'no explanation: ' + await page.eval(`document.getElementById('toast').textContent`));
  });

  await setPin();
  await step('with a phone PIN: switching on asks the real Android prompt, and the right PIN switches it on', async () => {
    await tap(page, 'lockToggle');
    await typePin();
    await page.until(`${stored('metaapp.lock')}==='1'`, 'the lock was not switched on after the PIN', 15000);
    need(focus().includes(PKG), 'the app is not in front: ' + focus().trim());
  });
  await sleep(1000);
  await step('the app is hidden from screenshots and the recent apps while the lock is on (FLAG_SECURE)', async () => {
    const [r, g, b] = pixel(540, 1200); shot('lock-01-secure');
    need(r < 6 && g < 6 && b < 6, `the screen capture shows the app: rgb(${r},${g},${b})`);
  });

  await step('opening the app again: it starts locked and asks at once', async () => {
    page.close(); page = await restart();
    await page.until(`document.getElementById('lockDlg')&&document.getElementById('lockDlg').open`, 'the app did not start locked', 30000);
  });
  await step('cancelling the prompt (Back) leaves the app locked, with a message and the button', async () => {
    await sleep(2500);
    // the first Back may only close the PIN keyboard, so press it until the Android prompt is gone
    for (let i = 0; i < 3 && !focus().includes(PKG); i++) { adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1500); }
    need(focus().includes(PKG), 'Back left the app: ' + focus().trim());
    await page.until(`/cancelado/.test(document.getElementById('lockMsg').textContent)`, 'no "cancelled" message', 8000);
    need(await locked(page), 'the app unlocked on a cancel');
    shot('lock-02-locked');
  });
  await step('Back on the lock screen leaves the app instead of showing it', async () => {
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1500);
    need(!focus().includes(PKG) || /Launcher|Nexus|Pixel/i.test(focus()), 'still in the app: ' + focus().trim());
    launch(); await sleep(1500);
    page.close(); page = await Page.connect();
    need(await locked(page), 'the app came back unlocked');
  });
  await step('the "Desbloquear" button asks again; the right PIN opens the app', async () => {
    await tap(page, 'lockRetry'); await typePin();
    await page.until(`!document.getElementById('lockDlg').open`, 'still locked after the PIN', 15000);
  });
  await step('a wrong PIN does not open the app', async () => {
    page.close(); page = await restart();
    await page.until(`document.getElementById('lockDlg').open`, 'not locked', 30000);
    await sleep(2500); adb('shell', 'input', 'text', '9999'); await sleep(300); adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER'); await sleep(2000);
    need(await locked(page), 'a wrong PIN unlocked the app');
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1500);
    await tap(page, 'lockRetry'); await typePin();
    await page.until(`!document.getElementById('lockDlg').open`, 'the right PIN did not open it after a wrong one', 15000);
  });

  await step('away for a few seconds: no new lock', async () => {
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(4000);
    adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`); await sleep(2500);
    page.close(); page = await Page.connect();
    need(!(await locked(page)), 'locked after only a few seconds away');
  });
  await step('away for more than 30 seconds: locks again and asks at once', async () => {
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(33000);
    adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`); await sleep(2500);
    page.close(); page = await Page.connect();
    await page.until(`document.getElementById('lockDlg').open`, 'the app was not locked after 33 s away', 10000);
    await tap(page, 'lockRetry'); await typePin();
    await page.until(`!document.getElementById('lockDlg').open`, 'the PIN did not open it', 15000);
  });

  await step('switching the lock off needs the PIN too', async () => {
    await toCfg(page); await sleep(300);
    await tap(page, 'lockToggle'); await sleep(2500); adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1500);
    need(await page.eval(`${stored('metaapp.lock')}==='1'`), 'switched off without confirmation');
    await tap(page, 'lockToggle'); await typePin();
    await page.until(`${stored('metaapp.lock')}===null`, 'not switched off after the PIN', 15000);
  });
  await step('after switching off, the app can be captured again and starts open', async () => {
    await sleep(800);
    const [r, g, b] = pixel(540, 1200);
    need(r + g + b > 60, `the capture is still black: rgb(${r},${g},${b})`);
    page.close(); page = await restart(); await ready(page, 'no redraw');
    need(!(await locked(page)), 'locked with the lock off');
  });

  await step('a phone that lost its screen lock: the app opens and the lock switches itself off (no lock-out)', async () => {
    await toCfg(page); await sleep(300);
    await tap(page, 'lockToggle'); await typePin();
    await page.until(`${stored('metaapp.lock')}==='1'`, 'not switched on', 15000);
    clearPin(); await sleep(1500);
    page.close(); page = await restart();
    await page.until(`!document.getElementById('lockDlg').open&&${stored('metaapp.lock')}===null`, 'the person was locked out or the lock stayed on', 30000);
    need(/sem bloqueio de tela/.test(await page.eval(`document.getElementById('toast').textContent`)), 'no explanation');
    shot('lock-03-lost-screen-lock');
  });

  await step('the app stayed alive: no crash, no script error', async () => {
    const log = adb('logcat', '-d', '-b', 'crash,main', '-s', 'AndroidRuntime:E');
    need(!/FATAL EXCEPTION/.test(log), log.slice(0, 400));
    // an earlier run showed "Application Not Responding" while leaving through Back on the lock screen: any ANR of the app now fails the test
    const anr = adb('logcat', '-d', '-b', 'system,main').split('\n').filter((l) => /ANR in .*com\.everfox\.app/.test(l));
    need(anr.length === 0, 'ANR: ' + anr.slice(0, 2).join(' || '));
    const bad = page.logs.filter((l) => /^exception|Uncaught|Refused to|Content Security Policy/i.test(l));
    need(bad.length === 0, bad.join(' || '));
  });
} finally {
  clearPin();
  page.close();
}
console.log(`\n${stats.results.length - stats.failed} ok, ${stats.failed} failed.`);
console.log(stats.failed ? 'LOCK DEVICE TEST FAILED' : 'LOCK DEVICE TEST OK');
process.exit(stats.failed ? 1 : 0);

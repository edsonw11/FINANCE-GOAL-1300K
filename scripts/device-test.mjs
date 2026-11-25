#!/usr/bin/env node
/**
 * scripts/device-test.mjs
 * Responsibility: tests the installed Android app on a real device or emulator, driving the real WebView through the DevTools protocol (needs Node 22 for the
 * global WebSocket) and Android itself through adb. Needs the APK built with MOBILE_DEBUG=1 (scripts/mobile.sh test does both).
 * Prints "ok" / "FAIL" lines; exit code 1 when anything failed. Screenshots go to $SHOTS (default /tmp/everfox-shots).
 */
import { execFileSync } from 'node:child_process';
import { ADB, PKG, SHOTS, Page, adb, focus, launch, need, pidOf, pixel, restart, shot, sleep, stats, step } from './lib/device.mjs';

/** How readable the status bar's clock is: the largest brightness difference to the bar's background, 0 (invisible) to 1 (black on white). */
const statusBarContrast = () => {
  const raw = execFileSync(ADB, ['exec-out', 'screencap'], { maxBuffer: 256 * 1024 * 1024 });
  const w = raw.readUInt32LE(0), k = w / 1080;
  const lum = (x, y) => { const o = 12 + (y * w + x) * 4; return (0.2126 * raw[o] + 0.7152 * raw[o + 1] + 0.0722 * raw[o + 2]) / 255; };
  const bg = lum(4, 4);
  let best = 0;
  for (let y = Math.round(20 * k); y < Math.round(90 * k); y += 2) for (let x = Math.round(40 * k); x < Math.round(260 * k); x += 2) best = Math.max(best, Math.abs(lum(x, y) - bg));
  return best;
};
const rgbOf = (css) => (css.match(/\d+/g) ?? []).slice(0, 3).map(Number);
const near = (a, b, tol = 6) => a.length === 3 && b.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= tol);
/** the strip behind the status bar and the one behind the gesture bar must be the page's own colour */
const barsMatchPage = async (page) => {
  const bg = rgbOf(await page.eval(`getComputedStyle(document.body).backgroundColor`));
  const top = pixel(4, 4), bottom = pixel(4, -4);
  need(near(top, bg) && near(bottom, bg), `behind the system bars: top rgb(${top}) bottom rgb(${bottom}), page rgb(${bg})`);
};

// --- the scenario helpers (the app's own screens, driven like a person would) ---
const addExpense = (value, desc) => `(async()=>{const $=i=>document.getElementById(i),w=ms=>new Promise(r=>setTimeout(r,ms));
  $('fab').click();await w(50);const r=document.querySelector('input[name=tp][value=despesa]');r.checked=true;r.dispatchEvent(new Event('change'));
  $('fVal').value=${JSON.stringify(value)};$('fCat').value='Mercado';$('fFonte').value='caixa';$('fDesc').value=${JSON.stringify(desc)};$('fSave').click();await w(100);
  if($('confirmDlg').open)$('cfOk').click();await w(50);if($('sheet').open)$('shClose').click();return true;})()`;
const stored = `JSON.parse(localStorage.getItem('metaapp.v2')||'{}')`;

console.log(`device: ${adb('shell', 'getprop', 'ro.product.model').trim()} Android ${adb('shell', 'getprop', 'ro.build.version.release').trim()} (API ${adb('shell', 'getprop', 'ro.build.version.sdk').trim()})`);
const apk = process.env.APK ?? 'android/app/build/outputs/apk/debug/app-debug.apk';
adb('install', '-r', apk);
adb('shell', 'pm', 'clear', PKG);
adb('shell', 'am', 'force-stop', PKG);
adb('logcat', '-c');

const t0 = Date.now();
launch();
let page = await Page.connect();
let ttc = -1;
await step('the app starts and draws its screens', async () => { ttc = await page.until("document.querySelectorAll('#nav button').length>=5", 'the app did not draw', 60000); });
console.log(`     time until the screens are drawn: ${((Date.now() - t0) / 1000).toFixed(1)} s from launch (${ttc} ms after the page was reachable)`);
shot('01-first-screen');
await step('light theme: behind the system bars is the page colour, and the clock is readable', async () => {
  await barsMatchPage(page);
  const c = statusBarContrast(); need(c > 0.4, `status bar contrast ${c.toFixed(2)}`);
});

await step('it runs inside the Android shell with the native plugins', async () => {
  const e = await page.eval(`({native:Capacitor.isNativePlatform(),platform:Capacitor.getPlatform(),origin:location.origin,share:typeof Capacitor.Plugins.Share?.share,fs:typeof Capacitor.Plugins.Filesystem?.writeFile})`);
  need(e.native && e.platform === 'android' && e.origin === 'https://localhost' && e.share === 'function' && e.fs === 'function', JSON.stringify(e));
});
await step('no CSP violation and no script error while starting', async () => {
  const bad = page.logs.filter((l) => /Content Security Policy|Refused to|^exception|Uncaught/i.test(l));
  need(bad.length === 0, bad.join(' || '));
});
await step('the policy is in force in the real WebView (an inline script is refused)', async () => {
  const ran = await page.eval(`(()=>{window.__x=0;const s=document.createElement('script');s.textContent='window.__x=1';document.head.appendChild(s);return window.__x;})()`);
  need(ran === 0, 'an inline script ran: the CSP is not applied');
});
await step('no sync card, no sync badge, and no request to the API', async () => {
  const r = await page.eval(`({card:document.getElementById('syncCard').hidden,badge:document.getElementById('syncBadge').hidden,api:performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\\/api\\/|\\/auth\\//.test(n))})`);
  need(r.card && r.badge && r.api.length === 0, JSON.stringify(r));
});

await step('an expense is added offline and appears in the list', async () => {
  await page.eval(addExpense('R$ 42,00', 'device smoke'));
  await page.eval(`document.querySelector('#nav [data-t=lanc]').click()`);
  await page.until(`document.body.textContent.includes('device smoke')`, 'the expense on screen', 5000);
  need((await page.eval(`${stored}.tx.some(t=>t.desc==='device smoke'&&t.value===42)`)), 'not stored');
});
shot('02-list');

await step('the data survives the app being killed and opened again', async () => {
  page.close(); page = await restart();
  await page.until("document.querySelectorAll('#nav button').length>=5", 'the app did not draw after restart', 60000);
  need((await page.eval(`${stored}.tx.some(t=>t.desc==='device smoke')`)), 'the expense is gone after a restart');
});

await step('test data (a year of records) loads and the heavy screens draw', async () => {
  await page.eval(`document.getElementById('demoOn').click()`);
  await sleep(1500);
  for (const t of ['resumo', 'lanc', 'cartao', 'meta', 'analise', 'cad', 'cfg']) {
    await page.eval(`document.querySelector('#nav [data-t=${t}]').click()`); await sleep(400);
  }
  need((await page.eval(`${stored}.tx.length`)) > 100, 'no test data');
  const errs = page.logs.filter((l) => /^exception|Uncaught|TypeError|ReferenceError/i.test(l));
  need(errs.length === 0, errs.join(' || '));
});

await step('a backup is written to the app cache and the system share sheet opens', async () => {
  await page.eval(`localStorage.removeItem('metaapp.lastBackup');document.getElementById('exp').click();true`);
  let f = '';
  for (let i = 0; i < 20 && !/chooser|intentresolver|Resolver/i.test(f); i++) { await sleep(500); f = focus(); }
  shot('03-share-sheet');
  need(/chooser|intentresolver|Resolver/i.test(f), 'the share sheet did not open; focus: ' + f.trim());
  const files = adb('shell', 'run-as', PKG, 'ls', 'cache').split('\n');
  need(files.includes('meta1300k-backup.json'), 'backup file not in cache: ' + files.join(','));
  const body = JSON.parse(adb('shell', 'run-as', PKG, 'cat', 'cache/meta1300k-backup.json'));
  need(Array.isArray(body.tx) && body.tx.length > 100 && body.tx.some((t) => t.desc === 'device smoke'), 'the backup file does not hold the state');
});
await step('closing the share sheet (Back) returns to the app', async () => {
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1500);
  need(focus().includes(PKG), 'the app is not in front: ' + focus().trim());
  const t = await page.eval(`document.getElementById('toast').textContent`);
  console.log(`     toast after closing the sheet: ${JSON.stringify(t)}; backup recorded: ${await page.eval(`localStorage.getItem('metaapp.lastBackup')!==null`)}`);
});

await step('restoring that backup brings everything back (the full round trip on the device)', async () => {
  // take the test data away, so that only the restore can bring it back
  await page.eval(`document.getElementById('demoOff').click();true`); await sleep(300);
  await page.eval(`(()=>{const o=document.getElementById('cfOk');if(document.getElementById('confirmDlg').open)o.click();return true;})()`); await sleep(500);
  const small = await page.eval(`${stored}.tx.length`);
  need(small < 10, 'the test data were not removed: ' + small);
  await page.setFiles('#file', ['/data/user/0/com.everfox.app/cache/meta1300k-backup.json']);
  await page.until(`${stored}.tx.length>100`, 'the backup was not restored', 8000);
  need(await page.eval(`${stored}.tx.some(t=>t.desc==='device smoke')&&${stored}.goal===1300000`), 'the restored state is not the backed-up one');
  need(/Backup importado/.test(await page.eval(`document.getElementById('toast').textContent`)), 'no confirmation message');
});

await step('the hardware Back button closes an open sheet instead of leaving the app', async () => {
  await page.eval(`document.querySelector('#nav [data-t=lanc]').click();true`); await sleep(300);
  await page.eval(`document.querySelector('[data-tx]').click();true`); await sleep(500);
  need(await page.eval(`document.getElementById('sheet').open`), 'the sheet did not open');
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await sleep(1200);
  need(focus().includes(PKG), 'Back left the app while a sheet was open');
  need(!(await page.eval(`document.getElementById('sheet').open`)), 'Back left the sheet open');
});

// --- the same screens at other sizes, in the dark theme and rotated: nothing may overflow sideways ---
const overflow = () => page.eval(`(()=>{const w=innerWidth;return {w,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>w+1&&getComputedStyle(e).position!=='fixed'&&!e.closest('.scroll-x,[class*=scroll],svg,table')}).slice(0,3).map(e=>e.tagName+'.'+e.className)}})()`);
const sizes = [['small phone', '720x1280', 320], ['normal phone', '1080x2400', 420], ['tablet', '1600x2560', 320]];
for (const [label, size, density] of sizes) {
  await step(`${label} (${size}): every tab fits the width`, async () => {
    adb('shell', 'wm', 'size', size); adb('shell', 'wm', 'density', String(density)); await sleep(2500);
    page.close(); page = await Page.connect();
    await page.until("document.querySelectorAll('#nav button').length>=5", 'redraw', 30000);
    const bad = [];
    for (const t of ['resumo', 'lanc', 'cartao', 'meta', 'analise', 'cad', 'cfg']) {
      await page.eval(`document.querySelector('#nav [data-t=${t}]').click();true`); await sleep(500);
      const o = await overflow();
      if (o.scroll > o.w + 1 || o.wide.length) bad.push(`${t}: scroll ${o.scroll} > ${o.w} ${o.wide.join(',')}`);
      if (t === 'resumo' || t === 'lanc') shot(`04-${label.replace(' ', '-')}-${t}`);
    }
    need(bad.length === 0, bad.join(' | '));
  });
}
adb('shell', 'wm', 'size', 'reset'); adb('shell', 'wm', 'density', 'reset'); await sleep(1500);

await step('dark theme: the screens draw and keep their contrast variables', async () => {
  adb('shell', 'cmd', 'uimode', 'night', 'yes'); await sleep(2500);
  page.close(); page = await Page.connect();
  await page.until("document.querySelectorAll('#nav button').length>=5", 'redraw in dark', 30000);
  const bg = await page.eval(`getComputedStyle(document.body).backgroundColor`);
  shot('05-dark');
  need(bg !== 'rgb(243, 245, 249)', 'the page stayed light: ' + bg);
});
await step('dark theme: behind the system bars is the page colour', () => barsMatchPage(page));
await step('dark theme switched on while the app is open: the clock and icons stay readable', async () => {
  const c = statusBarContrast();
  need(c > 0.4, `status bar contrast ${c.toFixed(2)} (icons are dark on a dark bar)`);
});
adb('shell', 'cmd', 'uimode', 'night', 'no'); await sleep(2000);
await step('light theme switched back while the app is open: the clock stays readable', async () => {
  const c = statusBarContrast(); need(c > 0.4, `status bar contrast ${c.toFixed(2)}`);
});

await step('rotated (landscape): the app survives and fits', async () => {
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0'); adb('shell', 'settings', 'put', 'system', 'user_rotation', '1'); await sleep(2500);
  page.close(); page = await Page.connect();
  await page.until("document.querySelectorAll('#nav button').length>=5", 'redraw rotated', 30000);
  const o = await overflow();
  shot('06-landscape');
  need(o.scroll <= o.w + 1, `scroll ${o.scroll} > ${o.w}`);
  need(await page.eval(`${stored}.tx.length>100`), 'data lost on rotation');
});
adb('shell', 'settings', 'put', 'system', 'user_rotation', '0'); adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '1');

await step('1500 random touches (monkey, fixed seed) leave the app alive, with no crash and no script error', async () => {
  adb('shell', 'am', 'force-stop', PKG); launch(); page.close(); page = await Page.connect();
  await page.until("document.querySelectorAll('#nav button').length>=5", 'redraw before the monkey', 30000);
  page.logs.length = 0; adb('logcat', '-c');
  try { adb('shell', 'monkey', '-p', PKG, '-s', '42', '--throttle', '80', '--pct-syskeys', '0', '--pct-appswitch', '0', '--pct-nav', '0', '--pct-majornav', '0', '--ignore-security-exceptions', '1500'); } catch (e) { throw new Error('monkey stopped: ' + String(e.stdout ?? e.message).slice(-300), { cause: e }); }
  need(pidOf() !== '', 'the app died during the random touches');
  const bad = page.logs.filter((l) => /^exception|Uncaught|TypeError|ReferenceError/i.test(l));
  need(bad.length === 0, bad.slice(0, 3).join(' || '));
  need(await page.eval(`(()=>{try{return JSON.parse(localStorage.getItem('metaapp.v2')).tx.length>0;}catch(e){return false;}})()`), 'the stored data is not valid after the random touches');
});

await step('the app stayed alive and silent: no crash, no ANR, no fatal log', async () => {
  const log = adb('logcat', '-d', '-b', 'crash,main', '-s', 'AndroidRuntime:E', 'ActivityManager:E', 'chromium:F');
  need(!/FATAL EXCEPTION|ANR in/.test(log), log.slice(0, 400));
  need(pidOf() !== '', 'the app is not running at the end');
  const bad = page.logs.filter((l) => /^exception|Uncaught|Refused to|Content Security Policy/i.test(l));
  need(bad.length === 0, bad.join(' || '));
});

page.close();
console.log(`\n${stats.results.length - stats.failed} ok, ${stats.failed} failed. Screenshots: ${SHOTS}`);
console.log(stats.failed ? 'DEVICE TEST FAILED' : 'DEVICE TEST OK');
process.exit(stats.failed ? 1 : 0);

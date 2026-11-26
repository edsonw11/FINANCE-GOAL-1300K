/**
 * scripts/lib/device.mjs
 * Responsibility: what the on-device tests share: adb, a DevTools connection to the page inside the app (the Page class, needs Node 22 for the global WebSocket),
 * a raw screen pixel, and the ok / FAIL step reporter.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const PKG = 'com.everfox.app';
export const ACTIVITY = `${PKG}/.MainActivity`;
export const SDK = process.env.ANDROID_HOME ?? `${process.env.HOME}/Android/Sdk`;
export const ADB = process.env.ADB ?? path.join(SDK, 'platform-tools', 'adb');
export const PORT = 9333;
export const SHOTS = process.env.SHOTS ?? '/tmp/everfox-shots';
mkdirSync(SHOTS, { recursive: true });

export const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r/g, '');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const stats = { results: [], failed: 0 };
export async function step(name, fn) {
  try { await fn(); stats.results.push(`ok   ${name}`); } catch (e) { stats.failed++; stats.results.push(`FAIL ${name}: ${e.message}`); }
  console.log(stats.results[stats.results.length - 1]);
}
export const need = (cond, msg) => { if (!cond) throw new Error(msg); };

/** A DevTools connection to the page inside the app. */
export class Page {
  #ws; #id = 0; #pending = new Map(); logs = [];
  static async connect() {
    let pid = '';
    for (let i = 0; i < 60 && !pid; i++) { try { pid = adb('shell', 'pidof', PKG).trim().split(/\s+/)[0]; } catch { /* not started yet: pidof exits 1 */ } if (!pid) await sleep(500); }
    need(pid, 'the app is not running');
    adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
    let target;
    for (let i = 0; i < 60 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page' && t.url.startsWith('https://localhost')); } catch { /* not ready yet */ }
      if (!target) await sleep(500);
    }
    need(target, 'no page at https://localhost (is WebView debugging on? use scripts/mobile.sh test)');
    const p = new Page();
    p.#ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { p.#ws.onopen = res; p.#ws.onerror = () => rej(new Error('devtools connection failed')); });
    p.#ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && p.#pending.has(d.id)) { const { res, rej } = p.#pending.get(d.id); p.#pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
      else if (d.method === 'Log.entryAdded') p.logs.push(`${d.params.entry.level} ${d.params.entry.source}: ${d.params.entry.text}`);
      else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type) && !/Error injecting safe area CSS/.test(d.params.args.map((a) => a.value ?? a.description).join(' '))) p.logs.push(`console.${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
      else if (d.method === 'Runtime.exceptionThrown') p.logs.push(`exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`);
    };
    await p.send('Log.enable'); await p.send('Runtime.enable');
    return p;
  }
  send(method, params = {}) { const id = ++this.#id; return new Promise((res, rej) => { this.#pending.set(id, { res, rej }); this.#ws.send(JSON.stringify({ id, method, params })); }); }
  /** Runs an expression (it may return a promise) in the page and returns its value. */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  async until(expression, what, ms = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (await this.eval(expression)) return Date.now() - t0; } catch { /* page not ready */ } await sleep(250); }
    throw new Error(`timeout: ${what}`);
  }
  /** Fills a file input the way the file picker would: the file is a path on the device that the app itself can read. */
  async setFiles(selector, paths) {
    const { root } = await this.send('DOM.getDocument');
    const { nodeId } = await this.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    need(nodeId, 'no element ' + selector);
    await this.send('DOM.setFileInputFiles', { nodeId, files: paths });
  }
  close() { this.#ws.close(); }
}

/** One pixel of the screen as [r,g,b] (raw screencap: a 12 byte header of width, height and format, then RGBA). */
export const pixel = (x, y) => {
  const raw = execFileSync(ADB, ['exec-out', 'screencap'], { maxBuffer: 256 * 1024 * 1024 });
  const w = raw.readUInt32LE(0), h = raw.readUInt32LE(4);
  const xx = x < 0 ? w + x : x, yy = y < 0 ? h + y : y, o = 12 + (yy * w + xx) * 4;
  return [raw[o], raw[o + 1], raw[o + 2]];
};

export const pidOf = () => { try { return adb('shell', 'pidof', PKG).trim(); } catch { return ''; } };
export const shot = (name) => writeFileSync(path.join(SHOTS, `${name}.png`), execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));
export const focus = () => adb('shell', 'dumpsys', 'window').split('\n').find((l) => l.includes('mCurrentFocus')) ?? '';
export const launch = () => { adb('shell', 'am', 'start', '-W', '-n', ACTIVITY); };
export const restart = async () => { adb('shell', 'am', 'force-stop', PKG); await sleep(1000); launch(); return Page.connect(); };

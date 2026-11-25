#!/usr/bin/env node
/**
 * services/telegram-apk/send-apk.mjs
 * Responsibility: the command line of the service: sends the Android test APK to a Telegram chat, after showing where it goes and asking.
 *
 *   node services/telegram-apk/send-apk.mjs --check                 prove the token and the chat work (posts nothing)
 *   node services/telegram-apk/send-apk.mjs                         ask, then send the debug APK to the FOXRISK chat
 *   node services/telegram-apk/send-apk.mjs --build --yes           build the APK first, send without asking
 *   options: --file <apk>  --chat <NAME>  --note "text"  --dry-run  --yes  --build  --check
 * Settings (token, chat ids) come from services/telegram-apk/.env or the environment; see .env.example.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { captionFor, megabytes, readApk } from './lib/apk.mjs';
import { chatsOf, loadSettings } from './lib/env.mjs';
import { DEFAULT_API, createTelegram } from './lib/telegram.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_APK = path.join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');

export function parseArgs(argv) {
  const o = { file: DEFAULT_APK, chat: undefined, note: undefined, dryRun: false, yes: false, build: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => { if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`${a} needs a value`); return argv[++i]; };
    if (a === '--file') o.file = path.resolve(value());
    else if (a === '--chat') o.chat = value().toUpperCase();
    else if (a === '--note') o.note = value();
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--yes') o.yes = true;
    else if (a === '--build') o.build = true;
    else if (a === '--check') o.check = true;
    else throw new Error(`unknown option: ${a}`);
  }
  return o;
}

/** Which chat: the one named, or the only one defined. */
export function pickChat(chats, wanted) {
  const names = Object.keys(chats);
  if (names.length === 0) throw new Error('no chat configured: set TELEGRAM_CHAT_ID_<NAME> in services/telegram-apk/.env');
  if (wanted) { if (!chats[wanted]) throw new Error(`no chat named ${wanted} (known: ${names.join(', ')})`); return { name: wanted, id: chats[wanted] }; }
  if (names.length > 1) throw new Error(`several chats configured (${names.join(', ')}): choose one with --chat <NAME>`);
  return { name: names[0], id: chats[names[0]] };
}

const git = (...args) => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined; } catch { return undefined; } };

export async function main(argv, { env = process.env, envFile = path.join(HERE, '.env'), out = console.log, fetchImpl = fetch, ask } = {}) {
  const opts = parseArgs(argv);
  const settings = loadSettings(envFile, env);
  const tg = createTelegram({ token: settings.TELEGRAM_TOKEN, baseUrl: settings.TELEGRAM_API_BASE || DEFAULT_API, fetchImpl });
  const chat = pickChat(chatsOf(settings), opts.chat);

  const me = await tg.getMe();
  const info = await tg.getChat(chat.id);
  out(`bot:  @${me.username}`);
  out(`chat: ${info.title ?? info.username ?? info.first_name} (${info.type}, ${chat.name})`);
  if (opts.check) { out('check OK: the token works and the bot can see the chat (nothing was posted)'); return 0; }

  if (opts.build) {
    out('building the APK…');
    const r = spawnSync('bash', ['scripts/mobile.sh', 'apk'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) throw new Error('the APK build failed');
  }
  const apk = readApk(opts.file);
  const caption = captionFor(apk, { commit: git('rev-parse', '--short', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), extra: opts.note });
  out(`file: ${apk.filename} (${megabytes(apk.size)})`);
  out(`caption:\n${caption.split('\n').map((l) => `  ${l}`).join('\n')}`);
  if (opts.dryRun) { out('dry run: nothing was sent'); return 0; }

  if (!opts.yes) {
    const answer = await (ask ?? defaultAsk)(`Send it to "${info.title ?? chat.name}" (${info.type}), where other people may see it? [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) { out('not sent'); return 1; }
  }
  const sent = await tg.sendDocument({ chatId: chat.id, bytes: apk.bytes, filename: apk.filename, caption });
  out(`sent: message ${sent.message_id} in ${chat.name}`);
  return 0;
}

async function defaultAsk(question) {
  if (!process.stdin.isTTY) throw new Error('cannot ask for confirmation here: run it in a terminal, or pass --yes');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(question); } finally { rl.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`ERROR: ${e.message}`); process.exit(2); });
}

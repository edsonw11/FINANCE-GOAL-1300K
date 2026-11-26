import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { main, parseArgs, pickChat } from '../send-apk.mjs';
import { CHAT, TOKEN, startFake } from './fake-telegram.mjs';

let fake, apkPath;
before(async () => {
  fake = await startFake();
  apkPath = path.join(mkdtempSync(path.join(tmpdir(), 'cli-')), 'app-debug.apk');
  writeFileSync(apkPath, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('apk body')]));
});
after(async () => { await fake.close(); });

// the tests never read the real .env of the developer
const NO_ENV_FILE = '/nonexistent/.env';
const env = (over = {}) => ({ TELEGRAM_TOKEN: TOKEN, TELEGRAM_CHAT_ID_FOXRISK: CHAT, TELEGRAM_API_BASE: fake.baseUrl, ...over });
const run = async (args, { environment = env(), answer } = {}) => {
  fake.requests.length = 0;
  const lines = [];
  const code = await main(args, { env: environment, envFile: NO_ENV_FILE, out: (l) => lines.push(l), ask: answer === undefined ? async () => { throw new Error('asked unexpectedly'); } : async () => answer });
  return { code, text: lines.join('\n') };
};

describe('parseArgs', () => {
  it('understands every option', () => {
    const o = parseArgs(['--file', 'x.apk', '--chat', 'foxrisk', '--note', 'hi', '--dry-run', '--yes', '--build', '--check']);
    assert.deepEqual([path.basename(o.file), o.chat, o.note, o.dryRun, o.yes, o.build, o.check], ['x.apk', 'FOXRISK', 'hi', true, true, true, true]);
  });
  it('defaults to the debug APK and nothing risky switched on', () => {
    const o = parseArgs([]);
    assert.match(o.file, /android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk$/);
    assert.deepEqual([o.dryRun, o.yes, o.build, o.check], [false, false, false, false]);
  });
  it('rejects unknown options and missing values', () => {
    assert.throws(() => parseArgs(['--nope']), /unknown option/);
    assert.throws(() => parseArgs(['--file']), /needs a value/);
    assert.throws(() => parseArgs(['--note', '--yes']), /needs a value/);
  });
});

describe('pickChat', () => {
  it('uses the only chat, or the named one', () => {
    assert.deepEqual(pickChat({ A: '1' }), { name: 'A', id: '1' });
    assert.deepEqual(pickChat({ A: '1', B: '2' }, 'B'), { name: 'B', id: '2' });
  });
  it('refuses to guess among several, and names that do not exist', () => {
    assert.throws(() => pickChat({ A: '1', B: '2' }), /choose one with --chat/);
    assert.throws(() => pickChat({ A: '1' }, 'Z'), /no chat named Z/);
    assert.throws(() => pickChat({}), /no chat configured/);
  });
});

describe('sending', () => {
  it('--check proves token and chat and posts nothing', async () => {
    const r = await run(['--check']);
    assert.equal(r.code, 0);
    assert.match(r.text, /@everfox_test_bot/);
    assert.match(r.text, /Test Group \(supergroup, FOXRISK\)/);
    assert.match(r.text, /nothing was posted/);
    assert.equal(fake.posts().length, 0);
  });
  it('--dry-run shows file and caption and posts nothing', async () => {
    const r = await run(['--dry-run', '--file', apkPath, '--note', 'try the Back button']);
    assert.equal(r.code, 0);
    assert.match(r.text, /file: app-debug\.apk/);
    assert.match(r.text, /sha256: [0-9a-f]{64}/);
    assert.match(r.text, /try the Back button/);
    assert.equal(fake.posts().length, 0);
  });
  it('--yes sends the document once, to the chat, with the checksum in the caption', async () => {
    const r = await run(['--yes', '--file', apkPath]);
    assert.equal(r.code, 0);
    assert.match(r.text, /sent: message 77 in FOXRISK/);
    const posts = fake.posts();
    assert.equal(posts.length, 1);
    assert.match(posts[0].url, /sendDocument$/);
    const body = posts[0].body.toString('latin1');
    assert.match(body, /-1001234567890/);
    assert.match(body, /sha256: [0-9a-f]{64}/);
  });
  it('without --yes it asks, naming the chat, and "n" sends nothing', async () => {
    const r = await run(['--file', apkPath], { answer: 'n' });
    assert.equal(r.code, 1);
    assert.match(r.text, /not sent/);
    assert.equal(fake.posts().length, 0);
  });
  it('an empty answer also means no', async () => {
    assert.equal((await run(['--file', apkPath], { answer: '' })).code, 1);
    assert.equal(fake.posts().length, 0);
  });
  it('"y" and "yes" send', async () => {
    for (const a of ['y', 'YES', ' yes ']) { const r = await run(['--file', apkPath], { answer: a }); assert.equal(r.code, 0, a); assert.equal(fake.posts().length, 1, a); }
  });
  it('the token never appears in what is printed', async () => {
    const r = await run(['--yes', '--file', apkPath]);
    assert.ok(!r.text.includes(TOKEN) && !r.text.includes('AAFakeToken'));
  });
});

describe('what stops it before anything is posted', () => {
  const expectFail = async (args, pattern, environment) => {
    await assert.rejects(run(args, { environment }), pattern);
    assert.equal(fake.posts().length, 0);
  };
  it('no token', () => expectFail(['--yes', '--file', apkPath], /TELEGRAM_TOKEN/, env({ TELEGRAM_TOKEN: '' })));
  it('no chat configured', () => expectFail(['--yes', '--file', apkPath], /no chat configured/, env({ TELEGRAM_CHAT_ID_FOXRISK: '' })));
  it('two chats and none chosen', () => expectFail(['--yes', '--file', apkPath], /choose one with --chat/, env({ TELEGRAM_CHAT_ID_OTHER: '5' })));
  it('a missing APK', () => expectFail(['--yes', '--file', '/nonexistent/app.apk'], /file not found/));
  it('a file that is not an APK', () => { const p = path.join(mkdtempSync(path.join(tmpdir(), 'bad-')), 'x.apk'); writeFileSync(p, 'text'); return expectFail(['--yes', '--file', p], /not a valid APK/); });
  it('a rejected token', async () => {
    const f = await startFake({ rejectToken: true });
    try { await assert.rejects(main(['--yes', '--file', apkPath], { env: env({ TELEGRAM_API_BASE: f.baseUrl }), envFile: NO_ENV_FILE, out: () => {} }), /Unauthorized/); assert.equal(f.posts().length, 0); } finally { await f.close(); }
  });
  it('a chat the bot cannot see', async () => {
    const f = await startFake({ unknownChat: true });
    try { await assert.rejects(main(['--yes', '--file', apkPath], { env: env({ TELEGRAM_API_BASE: f.baseUrl }), envFile: NO_ENV_FILE, out: () => {} }), /chat not found/); assert.equal(f.posts().length, 0); } finally { await f.close(); }
  });
});

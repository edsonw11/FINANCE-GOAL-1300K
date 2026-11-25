import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { MAX_DOCUMENT_BYTES, TelegramError, createTelegram, looksLikeToken } from '../lib/telegram.mjs';
import { CHAT, TOKEN, startFake } from './fake-telegram.mjs';

let fake;
before(async () => { fake = await startFake(); });
after(async () => { await fake.close(); });
const client = (over = {}) => createTelegram({ token: TOKEN, baseUrl: fake.baseUrl, ...over });

describe('token', () => {
  it('recognises the shape of a bot token', () => {
    assert.equal(looksLikeToken(TOKEN), true);
    for (const bad of ['', undefined, 'abc', '123:short', 'nocolon_' + 'x'.repeat(40), '12345678:has space ' + 'x'.repeat(30)]) assert.equal(looksLikeToken(bad), false, String(bad));
  });
  it('a bad token stops the client before any call', () => {
    assert.throws(() => createTelegram({ token: 'nope' }), (e) => e instanceof TelegramError && e.code === 'bad_token');
  });
});

describe('calls', () => {
  it('getMe and getChat return what Telegram says', async () => {
    assert.equal((await client().getMe()).username, 'everfox_test_bot');
    assert.deepEqual(await client().getChat(CHAT), { id: Number(CHAT), title: 'Test Group', type: 'supergroup' });
  });
  it('the token goes in the path and the chat id in the body', async () => {
    fake.requests.length = 0;
    await client().getChat(CHAT);
    assert.equal(fake.requests[0].url, `/bot${TOKEN}/getChat`);
    assert.deepEqual(JSON.parse(fake.requests[0].body.toString()), { chat_id: CHAT });
  });
  it('sendDocument sends the file bytes, its name, the chat and the caption as multipart', async () => {
    fake.requests.length = 0;
    const bytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('binary\x00\xff payload')]);
    const sent = await client().sendDocument({ chatId: CHAT, bytes, filename: 'app-debug.apk', caption: 'hello ação' });
    assert.equal(sent.message_id, 77);
    const r = fake.requests[0];
    assert.equal(r.url, `/bot${TOKEN}/sendDocument`);
    assert.match(r.headers['content-type'], /^multipart\/form-data; boundary=/);
    const text = r.body.toString('latin1');
    assert.match(text, /name="chat_id"\r\n\r\n-1001234567890\r\n/);
    assert.ok(r.body.toString('utf8').includes('hello ação'));
    assert.match(text, /name="document"; filename="app-debug\.apk"/);
    assert.match(text, /application\/vnd\.android\.package-archive/);
    assert.ok(r.body.includes(bytes), 'the exact bytes of the file must be in the request');
  });
  it('sendDocument without a caption sends none', async () => {
    fake.requests.length = 0;
    await client().sendDocument({ chatId: CHAT, bytes: Buffer.from('PK\x03\x04x'), filename: 'a.apk' });
    assert.doesNotMatch(fake.requests[0].body.toString('latin1'), /name="caption"/);
  });
  it('refuses a file over 50 MB before sending anything', () => {
    fake.requests.length = 0;
    assert.throws(() => client().sendDocument({ chatId: CHAT, bytes: { length: MAX_DOCUMENT_BYTES + 1 }, filename: 'big.apk' }), (e) => e.code === 'too_big');
    assert.equal(fake.requests.length, 0);
  });
});

describe('errors never carry the token', () => {
  it('an unauthorized answer is reported, with the token hidden', async () => {
    const f = await startFake({ rejectToken: true });
    try {
      await assert.rejects(createTelegram({ token: TOKEN, baseUrl: f.baseUrl }).getMe(), (e) => {
        assert.equal(e.code, '401');
        assert.match(e.message, /Unauthorized/);
        assert.ok(!e.message.includes(TOKEN) && !e.message.includes('AAFakeToken'), e.message);
        return true;
      });
    } finally { await f.close(); }
  });
  it('a chat that does not exist is reported with Telegram\'s words', async () => {
    const f = await startFake({ unknownChat: true });
    try { await assert.rejects(createTelegram({ token: TOKEN, baseUrl: f.baseUrl }).getChat(CHAT), /chat not found/); } finally { await f.close(); }
  });
  it('an answer that is not JSON is reported as such', async () => {
    const f = await startFake({ htmlError: true });
    try { await assert.rejects(createTelegram({ token: TOKEN, baseUrl: f.baseUrl }).getMe(), (e) => e.code === 'bad_response' && e.status === 502); } finally { await f.close(); }
  });
  it('a network failure does not leak the address (which holds the token)', async () => {
    const dead = createTelegram({ token: TOKEN, baseUrl: 'http://127.0.0.1:1' });
    await assert.rejects(dead.getMe(), (e) => {
      assert.equal(e.code, 'network');
      assert.ok(!e.message.includes(TOKEN) && !e.message.includes('AAFakeToken'), e.message);
      return true;
    });
  });
  it('an injected fetch that throws with the token in its message is scrubbed', async () => {
    const t = createTelegram({ token: TOKEN, fetchImpl: async () => { throw new Error(`boom ${TOKEN}`); } });
    await assert.rejects(t.getMe(), (e) => !e.message.includes(TOKEN));
  });
});

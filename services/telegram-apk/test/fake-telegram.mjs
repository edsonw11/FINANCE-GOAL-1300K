/**
 * test/fake-telegram.mjs
 * Responsibility: a Telegram Bot API stand-in on a local port: records every request (path, headers, raw body) and answers like Telegram does.
 */
import http from 'node:http';

export const TOKEN = '123456789:AAFakeTokenForTestsOnly_abcdefghijklmnopq';
export const CHAT = '-1001234567890';

/** @param {{rejectToken?:boolean, unknownChat?:boolean, htmlError?:boolean}} [opts] */
export async function startFake(opts = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      const reply = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
      if (opts.htmlError) { res.writeHead(502, { 'content-type': 'text/html' }); return res.end('<html>bad gateway</html>'); }
      const m = /^\/bot([^/]+)\/(\w+)$/.exec(req.url);
      if (!m || m[1] !== TOKEN || opts.rejectToken) return reply(401, { ok: false, error_code: 401, description: `Unauthorized (token ${m?.[1] ?? ''})` });
      if (m[2] === 'getMe') return reply(200, { ok: true, result: { id: 1, is_bot: true, username: 'everfox_test_bot' } });
      if (m[2] === 'getChat') {
        if (opts.unknownChat) return reply(400, { ok: false, error_code: 400, description: 'Bad Request: chat not found' });
        return reply(200, { ok: true, result: { id: Number(CHAT), title: 'Test Group', type: 'supergroup' } });
      }
      if (m[2] === 'sendDocument' || m[2] === 'sendMessage') return reply(200, { ok: true, result: { message_id: 77 } });
      return reply(404, { ok: false, error_code: 404, description: 'Not Found' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    /** requests that would post something to the chat */
    posts: () => requests.filter((r) => /\/(sendDocument|sendMessage)$/.test(r.url)),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}

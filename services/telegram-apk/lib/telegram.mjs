/**
 * lib/telegram.mjs
 * Responsibility: the three calls of the Telegram Bot API this service needs (getMe, getChat, sendDocument). Nothing prints or reads files here.
 * The token is never part of an error message: it is replaced by *** wherever it could appear.
 */
export const DEFAULT_API = 'https://api.telegram.org';
/** Telegram accepts documents up to 50 MB from a bot. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const TOKEN_SHAPE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;

export class TelegramError extends Error {
  constructor(message, { status, code } = {}) { super(message); this.name = 'TelegramError'; this.status = status; this.code = code; }
}

export const looksLikeToken = (token) => TOKEN_SHAPE.test(token ?? '');

/** @param {{token:string, baseUrl?:string, fetchImpl?:typeof fetch}} o */
export function createTelegram({ token, baseUrl = DEFAULT_API, fetchImpl = fetch }) {
  if (!looksLikeToken(token)) throw new TelegramError('TELEGRAM_TOKEN is missing or does not look like a bot token (123456:ABC…)', { code: 'bad_token' });
  const hide = (text) => String(text).split(token).join('***');

  async function call(method, init) {
    let res;
    try { res = await fetchImpl(`${baseUrl}/bot${token}/${method}`, init); } catch (e) {
      throw new TelegramError(hide(`could not reach Telegram (${e.cause?.code ?? e.code ?? e.message})`), { code: 'network' });
    }
    let body;
    try { body = await res.json(); } catch { throw new TelegramError(`Telegram answered ${res.status} without a JSON body`, { status: res.status, code: 'bad_response' }); }
    if (!res.ok || !body.ok) throw new TelegramError(hide(`Telegram refused ${method}: ${body.description ?? res.status}`), { status: res.status, code: String(body.error_code ?? res.status) });
    return body.result;
  }
  const json = (payload) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

  return {
    /** Who the bot is (proves the token works; posts nothing). */
    getMe: () => call('getMe', { method: 'GET' }),
    /** The chat (title, type): proves the bot can see it; posts nothing. */
    getChat: (chatId) => call('getChat', json({ chat_id: chatId })),
    sendMessage: (chatId, text) => call('sendMessage', json({ chat_id: chatId, text })),
    /** Sends a file as a document (no recompression) with a caption. */
    sendDocument({ chatId, bytes, filename, caption }) {
      if (bytes.length > MAX_DOCUMENT_BYTES) throw new TelegramError(`the file is ${(bytes.length / 1048576).toFixed(1)} MB; Telegram bots accept up to 50 MB`, { code: 'too_big' });
      const form = new FormData();
      form.set('chat_id', String(chatId));
      if (caption) form.set('caption', caption);
      form.set('document', new Blob([bytes], { type: 'application/vnd.android.package-archive' }), filename);
      return call('sendDocument', { method: 'POST', body: form });
    },
  };
}

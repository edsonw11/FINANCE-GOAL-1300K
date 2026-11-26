import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BODY_LIMIT_BYTES, createAdapter } from '../../src/create-app';

// The HTTP server on its own, with two probe routes: what it does with big bodies and with a forged proxy header.
const adapter = createAdapter();
const server = adapter.getInstance();

beforeAll(async () => {
  server.get('/ip', async (request) => ({ ip: request.ip, ips: request.ips ?? null }));
  server.post('/echo-size', async (request) => ({ size: JSON.stringify(request.body).length }));
  await server.ready();
});
afterAll(async () => {
  await server.close();
});

const post = (body: unknown) =>
  server.inject({ method: 'POST', url: '/echo-size', headers: { 'content-type': 'application/json' }, payload: JSON.stringify(body) });

describe('body size limit', () => {
  it('is 1 MiB', () => {
    expect(BODY_LIMIT_BYTES).toBe(1_048_576);
  });

  it('accepts a body one byte under the limit', async () => {
    // {"x":"..."} has 8 bytes besides the text
    const res = await post({ x: 'a'.repeat(BODY_LIMIT_BYTES - 9) });
    expect(res.statusCode).toBe(200);
  });

  it('accepts a body of exactly the limit', async () => {
    const res = await post({ x: 'a'.repeat(BODY_LIMIT_BYTES - 8) });
    expect(res.statusCode).toBe(200);
  });

  it('refuses a body one byte over the limit with 413', async () => {
    const res = await post({ x: 'a'.repeat(BODY_LIMIT_BYTES - 7) });
    expect(res.statusCode).toBe(413);
  });

  it('refuses a much larger body with 413 too', async () => {
    const res = await post({ x: 'a'.repeat(BODY_LIMIT_BYTES * 4) });
    expect(res.statusCode).toBe(413);
  });
});

describe('client address', () => {
  it('is the address of the connection', async () => {
    const res = await server.inject({ method: 'GET', url: '/ip', remoteAddress: '203.0.113.9' });
    expect(res.json().ip).toBe('203.0.113.9');
  });

  it.each(['6.6.6.6', '127.0.0.1', '10.0.0.1, 6.6.6.6'])('is not changed by a forged X-Forwarded-For: %s', async (forged) => {
    const res = await server.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '203.0.113.9',
      headers: { 'x-forwarded-for': forged },
    });
    expect(res.json().ip).toBe('203.0.113.9');
  });

  it('is not changed by Forwarded or X-Real-IP either', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '203.0.113.9',
      headers: { forwarded: 'for=6.6.6.6', 'x-real-ip': '6.6.6.6' },
    });
    expect(res.json().ip).toBe('203.0.113.9');
  });
});

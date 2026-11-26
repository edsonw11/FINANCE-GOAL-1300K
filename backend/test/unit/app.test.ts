import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BODY_LIMIT_BYTES, createAdapter, createApp } from '../../src/create-app';
import { PrismaService } from '../../src/database/prisma.service';
import { loadConfig } from '../../src/config/load-config';
import { OIDC_DEV } from '../support/env';

// The whole application, with the database unreachable on purpose: what a client sees while it is down.
const SECRET = 'Sup3rSecretPw';
const config = loadConfig({
  ...OIDC_DEV,
  DATABASE_URL: `postgresql://app:${SECRET}@127.0.0.1:1/everfox`,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  HEALTH_CHECK_TIMEOUT_MS: '3000',
});

let app: NestFastifyApplication;

// A new application for every test: the last test closes it, so it cannot be shared.
beforeEach(async () => {
  app = await createApp(config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterEach(async () => {
  await app.close().catch(() => undefined);
});

const get = (url: string) => app.inject({ method: 'GET', url });

describe('the application with the database down', () => {
  it('is alive: /health/live answers 200', async () => {
    const res = await get('/health/live');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('is not ready: /health/ready answers 503 and names the database as down', async () => {
    const res = await get('/health/ready');
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('error');
    expect(body.checks).toEqual([{ name: 'database', status: 'down', durationMs: expect.any(Number) }]);
  });

  it('answers /health/ready quickly when the connection is refused (no waiting for the full limit)', async () => {
    const started = Date.now();
    await get('/health/ready');
    expect(Date.now() - started).toBeLessThan(config.healthCheckTimeoutMs);
  });

  it('does not tell the client the address, the user or the password of the database', async () => {
    const res = await get('/health/ready');
    for (const leak of [SECRET, '127.0.0.1', 'ECONNREFUSED', 'everfox', 'app:', 'postgresql']) expect(res.body).not.toContain(leak);
  });
});

describe('the application in general', () => {
  it('answers an unknown path with a plain 404 and no internals', async () => {
    const res = await get('/nothing/here');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Cannot GET /nothing/here' });
    expect(res.body).not.toMatch(/\bat\s.+\(.+:\d+:\d+\)/); // no stack trace
  });

  it('does not announce the framework', async () => {
    expect((await get('/health/live')).headers['x-powered-by']).toBeUndefined();
  });

  it('keeps the configuration frozen', () => {
    expect(Object.isFrozen(config)).toBe(true);
  });

  // The spy is made here, not in a hook, because restoreMocks removes spies between tests.
  it('closes the database pool when it shuts down', async () => {
    const disconnect = vi.spyOn(app.get(PrismaService), '$disconnect');
    await app.close();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

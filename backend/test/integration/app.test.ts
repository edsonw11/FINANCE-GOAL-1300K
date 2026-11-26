import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/create-app';
import { databaseUrl, testConfig, withDatabase, withPassword } from './support';

const apps: NestFastifyApplication[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function start(databaseUrlOverride?: string) {
  const app = await createApp(testConfig(databaseUrlOverride ? { DATABASE_URL: databaseUrlOverride } : {}));
  apps.push(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('the application with a real database', () => {
  it('is ready: /health/ready answers 200 and the database is up', async () => {
    const res = await (await start()).inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: [{ name: 'database', status: 'up', durationMs: expect.any(Number) }] });
  });

  it('answers over a real socket too', async () => {
    const app = await start();
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    expect((await fetch(`${base}/health/live`)).status).toBe(200);
    const ready = await fetch(`${base}/health/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ status: 'ok' });
  });

  it('keeps answering after many requests (no connection leak)', async () => {
    const app = await start();
    const answers = await Promise.all(Array.from({ length: 100 }, () => app.inject({ method: 'GET', url: '/health/ready' })));
    expect(answers.every((r) => r.statusCode === 200)).toBe(true);
  });

  it('is alive but not ready with the wrong password, and says nothing about why', async () => {
    const app = await start(withPassword(databaseUrl(), 'wrong-password-123'));
    expect((await app.inject({ method: 'GET', url: '/health/live' })).statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    for (const leak of ['wrong-password-123', 'password', 'authentication', 'everfox', '127.0.0.1']) expect(res.body).not.toContain(leak);
  });

  it('is not ready when the database does not exist', async () => {
    const app = await start(withDatabase(databaseUrl(), 'nope_not_here'));
    expect((await app.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(503);
  });

  it('becomes ready as soon as the database is reachable (it does not remember a failure)', async () => {
    const down = await start(withPassword(databaseUrl(), 'wrong-password-123'));
    const up = await start();
    expect((await down.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(503);
    expect((await up.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(200);
  });
});

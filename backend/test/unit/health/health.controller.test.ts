import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type HealthReport } from '../../../src/health/health-check';
import { HealthController } from '../../../src/health/health.controller';
import { HealthService } from '../../../src/health/health.service';

const UP: HealthReport = { status: 'ok', checks: [{ name: 'database', status: 'up', durationMs: 3 }] };
const DOWN: HealthReport = { status: 'error', checks: [{ name: 'database', status: 'down', durationMs: 2001 }] };

let app: NestFastifyApplication;
const readiness = vi.fn<() => Promise<HealthReport>>();

beforeEach(async () => {
  readiness.mockReset();
  const module = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: HealthService, useValue: { readiness } }],
  }).compile();
  // logger off: the 500 test makes Nest log the error on purpose, which only adds noise here
  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterEach(async () => {
  await app.close();
});

const get = (url: string) => app.inject({ method: 'GET', url });

describe('GET /health/live', () => {
  it('answers 200 {status: ok}', async () => {
    const res = await get('/health/live');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('never asks the dependencies: a database outage must not make the orchestrator restart the API', async () => {
    readiness.mockRejectedValue(new Error('would hang'));
    const res = await get('/health/live');
    expect(res.statusCode).toBe(200);
    expect(readiness).not.toHaveBeenCalled();
  });
});

describe('GET /health/ready', () => {
  it('answers 200 with the report when everything is up', async () => {
    readiness.mockResolvedValue(UP);
    const res = await get('/health/ready');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(UP);
  });

  it('answers 503 with the report when something is down', async () => {
    readiness.mockResolvedValue(DOWN);
    const res = await get('/health/ready');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual(DOWN);
  });

  it('asks the checks every time (no stale answer)', async () => {
    readiness.mockResolvedValueOnce(DOWN).mockResolvedValueOnce(UP);
    expect((await get('/health/ready')).statusCode).toBe(503);
    expect((await get('/health/ready')).statusCode).toBe(200);
    expect(readiness).toHaveBeenCalledTimes(2);
  });

  it('answers 500 without details when the service itself breaks', async () => {
    readiness.mockRejectedValue(new Error('internal detail: db password is x'));
    const res = await get('/health/ready');
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('internal detail');
    expect(res.body).not.toContain('password');
  });
});

describe('the routes', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('do not answer %s', async (method) => {
    expect((await app.inject({ method, url: '/health/live' })).statusCode).toBe(404);
    expect((await app.inject({ method, url: '/health/ready' })).statusCode).toBe(404);
  });

  it('do not exist under other names', async () => {
    for (const url of ['/health', '/health/', '/health/status', '/health/live/x', '/healthz', '/api/v1/health/live']) {
      expect((await get(url)).statusCode, url).toBe(404);
    }
  });

  it('set a cookie never, and say nothing about the framework', async () => {
    const res = await get('/health/live');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type HealthCheck } from '../../../src/health/health-check';
import { HealthService } from '../../../src/health/health.service';

const LIMIT = 1000;
const config = { healthCheckTimeoutMs: LIMIT };

/** A check that finishes after `ms` (fake time), failing or not. */
const after = (name: string, ms: number, fail?: unknown): HealthCheck => ({
  name,
  run: () =>
    new Promise<void>((resolve, reject) => {
      setTimeout(() => (fail === undefined ? resolve() : reject(fail)), ms);
    }),
});
const fine = (name: string): HealthCheck => ({ name, run: async () => undefined });
const broken = (name: string, reason: unknown = new Error('boom')): HealthCheck => ({ name, run: () => Promise.reject(reason) });

const service = (...checks: HealthCheck[]) => new HealthService(checks, config);
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
});

/** Runs readiness and moves the fake clock until it is done. */
async function ready(s: HealthService, advanceMs = 0) {
  const pending = s.readiness();
  await vi.advanceTimersByTimeAsync(advanceMs);
  return pending;
}

describe('HealthService.readiness', () => {
  it('is ok when there is nothing to check', async () => {
    expect(await ready(service())).toEqual({ status: 'ok', checks: [] });
  });

  it('is ok when every check passes, and lists each one', async () => {
    const report = await ready(service(fine('database'), fine('queue')));
    expect(report.status).toBe('ok');
    expect(report.checks.map((c) => [c.name, c.status])).toEqual([
      ['database', 'up'],
      ['queue', 'up'],
    ]);
  });

  it('is an error when one check fails, and the others are still reported', async () => {
    const report = await ready(service(fine('database'), broken('queue'), fine('idp')));
    expect(report.status).toBe('error');
    expect(report.checks.map((c) => [c.name, c.status])).toEqual([
      ['database', 'up'],
      ['queue', 'down'],
      ['idp', 'up'],
    ]);
  });

  it('is an error when every check fails', async () => {
    const report = await ready(service(broken('a'), broken('b')));
    expect(report.status).toBe('error');
    expect(report.checks.every((c) => c.status === 'down')).toBe(true);
  });

  it('keeps the order of the checks, whatever finishes first', async () => {
    const report = await ready(service(after('slow', 300), after('fast', 10)), 300);
    expect(report.checks.map((c) => c.name)).toEqual(['slow', 'fast']);
  });
});

describe('HealthService: failures', () => {
  it('writes the reason to the log, not to the report', async () => {
    const report = await ready(service(broken('database', new Error('password authentication failed for user "app" at 10.0.0.5'))));
    const text = JSON.stringify(report);
    expect(text).not.toContain('password');
    expect(text).not.toContain('10.0.0.5');
    expect(text).not.toContain('app');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"database" failed');
    expect(warn.mock.calls[0]?.[0]).toContain('password authentication failed');
  });

  it('copes with a check that rejects with something that is not an Error', async () => {
    const report = await ready(service(broken('a', 'just a string'), broken('b', undefined), broken('c', { code: 42 })));
    expect(report.checks.map((c) => c.status)).toEqual(['down', 'down', 'down']);
    expect(warn.mock.calls[0]?.[0]).toContain('just a string');
  });

  it('copes with a check that throws before returning a promise', async () => {
    const throwing: HealthCheck = {
      name: 'sync',
      run: () => {
        throw new Error('thrown at once');
      },
    };
    const report = await ready(service(throwing, fine('ok')));
    expect(report.checks.map((c) => c.status)).toEqual(['down', 'up']);
  });

  it('is not tricked by a check that fails twice or after it was answered', async () => {
    const late: HealthCheck = { name: 'late', run: () => after('x', LIMIT + 500, new Error('too late')).run() };
    const report = await ready(service(late), LIMIT + 600);
    expect(report.checks[0]?.status).toBe('down');
  });
});

describe('HealthService: time limit', () => {
  it('marks a check that never answers as down after the limit', async () => {
    const hanging: HealthCheck = { name: 'hang', run: () => new Promise<void>(() => undefined) };
    const report = await ready(service(hanging), LIMIT);
    expect(report).toEqual({ status: 'error', checks: [{ name: 'hang', status: 'down', durationMs: LIMIT }] });
    expect(warn.mock.calls[0]?.[0]).toContain(`timed out after ${LIMIT} ms`);
  });

  it('accepts a check that answers just before the limit', async () => {
    const report = await ready(service(after('edge', LIMIT - 1)), LIMIT);
    expect(report.checks[0]).toMatchObject({ status: 'up', durationMs: LIMIT - 1 });
  });

  it('refuses a check that answers at the limit or later', async () => {
    const report = await ready(service(after('edge', LIMIT + 1)), LIMIT + 1);
    expect(report.checks[0]?.status).toBe('down');
  });

  it('uses the limit from the configuration', async () => {
    const short = new HealthService([after('x', 150)], { healthCheckTimeoutMs: 100 });
    const report = await ready(short, 150);
    expect(report.checks[0]?.status).toBe('down');
  });

  it('does not let one slow check delay or fail a fast one', async () => {
    const hanging: HealthCheck = { name: 'hang', run: () => new Promise<void>(() => undefined) };
    const report = await ready(service(hanging, after('fast', 20)), LIMIT);
    expect(report.checks.map((c) => [c.name, c.status])).toEqual([
      ['hang', 'down'],
      ['fast', 'up'],
    ]);
  });

  it('runs the checks at the same time, not one after the other', async () => {
    const report = await ready(service(after('a', 400), after('b', 400), after('c', 400)), 400);
    expect(report.status).toBe('ok'); // one after the other would be 1200 ms and the limit is 1000 each, but the total was 400
    expect(vi.getTimerCount()).toBe(0);
  });

  it('measures how long each check took', async () => {
    const report = await ready(service(after('a', 120), after('b', 30)), 120);
    expect(report.checks.map((c) => c.durationMs)).toEqual([120, 30]);
  });

  it.each([
    ['passes', () => fine('a')],
    ['fails', () => broken('a')],
    ['hangs', (): HealthCheck => ({ name: 'a', run: () => new Promise<void>(() => undefined) })],
  ])('leaves no timer running when a check %s', async (_what, make) => {
    await ready(service(make()), LIMIT);
    expect(vi.getTimerCount()).toBe(0);
  });
});

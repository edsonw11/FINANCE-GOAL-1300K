import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT } from '../../../src/security/rate-limit.decorator';
import { PersonRateLimitGuard } from '../../../src/security/rate-limit.guard';
import { RateLimiter } from '../../../src/security/rate-limiter';
import { FakeClock } from '../../support/fakes';

const handler = () => undefined;
Reflect.defineMetadata(RATE_LIMIT, { name: 'x', limit: 1, windowMs: 1000, by: 'person' }, handler);
const context = (request: object): ExecutionContext =>
  ({ getHandler: () => handler, getClass: () => class {}, switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ header: () => undefined }) }) }) as unknown as ExecutionContext;

describe('PersonRateLimitGuard', () => {
  const guard = () => new PersonRateLimitGuard(new Reflector(), new RateLimiter(new FakeClock()), { rateLimitFactor: 1 });

  it('counts a signed-in person', () => {
    const g = guard();
    const request = { auth: { userId: 'u1' }, ip: '1.1.1.1' };
    expect(g.canActivate(context(request))).toBe(true);
    expect(() => g.canActivate(context(request))).toThrow();
  });

  it('has nothing to count for a request nobody signed in for (the login check answers that one), and does not fail on it', () => {
    const g = guard();
    for (let i = 0; i < 5; i++) expect(g.canActivate(context({ ip: '1.1.1.1' }))).toBe(true);
  });
});

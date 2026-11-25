import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../../../src/auth/auth.guard';
import { Public } from '../../../src/auth/public.decorator';
import { SessionService } from '../../../src/auth/session.service';
import { FakeClock, InMemorySessionRepository } from '../../support/fakes';

const cookies = { sessionName: 'sid', flowName: 'flow', secure: false };

class Open {
  @Public()
  open() {}
  closed() {}
}
@Public()
class OpenClass {
  any() {}
}

let sessions: SessionService;
let guard: AuthGuard;
let clearCookie: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessions = new SessionService(new InMemorySessionRepository(), { session: { ttlMs: 3_600_000, idleMs: 1_800_000 } }, new FakeClock());
  guard = new AuthGuard(new Reflector(), sessions, { cookies });
  clearCookie = vi.fn();
});

const context = (cls: new () => object, method: string, cookie?: unknown): { ctx: ExecutionContext; request: { cookies: Record<string, unknown>; auth?: unknown } } => {
  const request: { cookies: Record<string, unknown>; auth?: unknown } = { cookies: cookie === undefined ? {} : { sid: cookie } };
  const ctx = {
    getHandler: () => (cls.prototype as Record<string, () => void>)[method],
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ clearCookie }) }),
  } as unknown as ExecutionContext;
  return { ctx, request };
};

describe('AuthGuard (deny by default)', () => {
  it('refuses a route that is not public when there is no cookie, and has nothing to clear', async () => {
    await expect(guard.canActivate(context(Open, 'closed').ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it('refuses a cookie that does not work, and removes it from the browser', async () => {
    await expect(guard.canActivate(context(Open, 'closed', 'a'.repeat(43)).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(clearCookie).toHaveBeenCalledWith('sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: false });
  });

  it.each([['junk', 'abc'], ['a number', 5], ['an array', ['x']]])('refuses a cookie that is %s', async (_l, value) => {
    await expect(guard.canActivate(context(Open, 'closed', value).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets a valid session in and says who it is, for the controller to use', async () => {
    const { token } = await sessions.create('user-1');
    const { ctx, request } = context(Open, 'closed', token);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.auth).toMatchObject({ userId: 'user-1' });
  });

  it('lets a public handler through without a session, and sets nobody as logged in', async () => {
    const { ctx, request } = context(Open, 'open');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.auth).toBeUndefined();
  });

  it('a public class makes all its handlers public', async () => {
    await expect(guard.canActivate(context(OpenClass, 'any').ctx)).resolves.toBe(true);
  });

  it('a public handler does not make its sibling public', async () => {
    await expect(guard.canActivate(context(Open, 'closed').ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

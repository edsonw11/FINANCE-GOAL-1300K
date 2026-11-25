import { beforeEach, describe, expect, it } from 'vitest';
import { LOGIN_FLOW_TTL_MS, LoginService } from '../../../src/auth/login.service';
import { LoginFailedError } from '../../../src/auth/oidc-provider';
import { hashToken, newOpaqueToken } from '../../../src/auth/opaque-token';
import { SessionService } from '../../../src/auth/session.service';
import { FakeClock, FakeOidcProvider, InMemoryAuthFlowRepository, InMemorySessionRepository, InMemoryUserRepository } from '../../support/fakes';

const CALLBACK = (state: string, extra = '') => new URL(`http://localhost:3000/auth/callback?code=c&state=${encodeURIComponent(state)}${extra}`);

let clock: FakeClock;
let provider: FakeOidcProvider;
let flows: InMemoryAuthFlowRepository;
let users: InMemoryUserRepository;
let sessionRepo: InMemorySessionRepository;
let sessions: SessionService;
let service: LoginService;

beforeEach(() => {
  clock = new FakeClock();
  provider = new FakeOidcProvider();
  flows = new InMemoryAuthFlowRepository();
  users = new InMemoryUserRepository();
  sessionRepo = new InMemorySessionRepository();
  sessions = new SessionService(sessionRepo, { session: { ttlMs: 3_600_000, idleMs: 1_800_000 } }, clock);
  service = new LoginService(provider, flows, users, sessions, clock);
});

const lastState = () => provider.requests[provider.requests.length - 1]!.state;

describe('LoginService.begin', () => {
  it('sends the person to the address the provider made', async () => {
    const begun = await service.begin('/dashboard');
    expect(begun.authorizationUrl).toBe(provider.requests[0]!.url);
  });

  it('stores the attempt under the hash of the cookie value, never the value', async () => {
    const begun = await service.begin('/x');
    expect(begun.flowToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...flows.rows.keys()]).toEqual([hashToken(begun.flowToken)]);
    expect(JSON.stringify([...flows.rows.values()])).not.toContain(begun.flowToken);
  });

  it('keeps state, nonce and verifier for the return', async () => {
    const begun = await service.begin('/x');
    const stored = flows.rows.get(hashToken(begun.flowToken))!;
    const asked = provider.requests[0]!;
    expect([stored.state, stored.nonce, stored.codeVerifier]).toEqual([asked.state, asked.nonce, asked.codeVerifier]);
  });

  it('gives ten minutes to finish', async () => {
    const begun = await service.begin('/x');
    expect(begun.flowExpiresAt.getTime()).toBe(clock.now().getTime() + LOGIN_FLOW_TTL_MS);
    expect(LOGIN_FLOW_TTL_MS).toBe(600_000);
  });

  it('keeps a safe return path and replaces an unsafe one by "/"', async () => {
    const good = await service.begin('/accounts?tab=1');
    const bad = await service.begin('//evil.example');
    expect(flows.rows.get(hashToken(good.flowToken))!.returnTo).toBe('/accounts?tab=1');
    expect(flows.rows.get(hashToken(bad.flowToken))!.returnTo).toBe('/');
  });

  it('gives each attempt its own cookie value', async () => {
    const a = await service.begin('/');
    const b = await service.begin('/');
    expect(a.flowToken).not.toBe(b.flowToken);
  });

  it('removes attempts that nobody finished', async () => {
    await service.begin('/');
    clock.advance(LOGIN_FLOW_TTL_MS + 1);
    await service.begin('/');
    expect(flows.rows.size).toBe(1);
  });

  it('stores nothing when the provider cannot be reached, and the error goes up', async () => {
    provider.failBegin = new Error('provider down');
    await expect(service.begin('/')).rejects.toThrow('provider down');
    expect(flows.rows.size).toBe(0);
  });
});

describe('LoginService.complete', () => {
  it('logs the person in: a user, a session, and the path to return to', async () => {
    const begun = await service.begin('/accounts');
    const done = await service.complete(begun.flowToken, CALLBACK(lastState()));
    expect(done.returnTo).toBe('/accounts');
    expect(done.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await sessions.authenticate(done.sessionToken)).toEqual({ userId: done.userId, sessionId: hashToken(done.sessionToken) });
    expect(done.sessionExpiresAt.getTime()).toBe(clock.now().getTime() + 3_600_000);
    expect(users.users.get(done.userId)).toMatchObject({ issuer: provider.identity.issuer, subject: 'sub-alice', email: 'alice@example.test' });
  });

  it('gives the provider exactly what was stored for this attempt', async () => {
    const begun = await service.begin('/');
    await service.complete(begun.flowToken, CALLBACK(lastState()));
    const asked = provider.requests[0]!;
    expect(provider.callbacks[0]!.expected).toMatchObject({ state: asked.state, nonce: asked.nonce, codeVerifier: asked.codeVerifier });
  });

  it('logging in again is the same person, not a new one', async () => {
    const first = await service.complete((await service.begin('/')).flowToken, CALLBACK(lastState()));
    const second = await service.complete((await service.begin('/')).flowToken, CALLBACK(lastState()));
    expect(second.userId).toBe(first.userId);
    expect(users.users.size).toBe(1);
    expect(second.sessionToken).not.toBe(first.sessionToken);
  });

  it('two different people with the same e-mail stay two people', async () => {
    const alice = await service.complete((await service.begin('/')).flowToken, CALLBACK(lastState()));
    provider.identity = { ...provider.identity, subject: 'sub-impostor' };
    const other = await service.complete((await service.begin('/')).flowToken, CALLBACK(lastState()));
    expect(other.userId).not.toBe(alice.userId);
  });

  describe('what makes it fail', () => {
    const failsWith = async (flowToken: unknown, url = CALLBACK('whatever')) => {
      const error = await service.complete(flowToken, url).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(LoginFailedError);
      return error as LoginFailedError;
    };

    it.each([['missing', undefined], ['empty', ''], ['junk', 'abc'], ['a number', 5], ['too long', 'a'.repeat(5000)]])('a login cookie that is %s', async (_l, value) => {
      await failsWith(value);
      expect(sessionRepo.rows.size).toBe(0);
    });

    it('a login cookie that was never issued', async () => {
      await service.begin('/');
      await failsWith(newOpaqueToken(), CALLBACK(lastState()));
      expect(sessionRepo.rows.size).toBe(0);
    });

    it('an attempt used a second time (the browser back button, or a stolen link)', async () => {
      const begun = await service.begin('/');
      const url = CALLBACK(lastState());
      await service.complete(begun.flowToken, url);
      await failsWith(begun.flowToken, url);
      expect(sessionRepo.rows.size).toBe(1);
    });

    it('two returns at the same time: exactly one logs in', async () => {
      const begun = await service.begin('/');
      const url = CALLBACK(lastState());
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => service.complete(begun.flowToken, url)));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(sessionRepo.rows.size).toBe(1);
    });

    it('an attempt that took too long, even by one millisecond', async () => {
      const begun = await service.begin('/');
      clock.advance(LOGIN_FLOW_TTL_MS);
      const error = await failsWith(begun.flowToken, CALLBACK(lastState()));
      expect(error.reason).toContain('expired');
      expect(sessionRepo.rows.size).toBe(0);
    });

    it('an attempt one millisecond before the limit still works', async () => {
      const begun = await service.begin('/');
      clock.advance(LOGIN_FLOW_TTL_MS - 1);
      await expect(service.complete(begun.flowToken, CALLBACK(lastState()))).resolves.toBeDefined();
    });

    it('a wrong state, and the attempt is used up (the attacker cannot try again)', async () => {
      const begun = await service.begin('/');
      await failsWith(begun.flowToken, CALLBACK('forged-state'));
      await failsWith(begun.flowToken, CALLBACK(lastState()));
      expect(sessionRepo.rows.size).toBe(0);
      expect(users.users.size).toBe(0);
    });

    it('the provider answering with an error (the person said no)', async () => {
      const begun = await service.begin('/');
      await failsWith(begun.flowToken, CALLBACK(lastState(), '&error=access_denied'));
      expect(sessionRepo.rows.size).toBe(0);
    });

    it('a return without a code', async () => {
      const begun = await service.begin('/');
      await failsWith(begun.flowToken, new URL(`http://localhost:3000/auth/callback?state=${encodeURIComponent(lastState())}`));
      expect(sessionRepo.rows.size).toBe(0);
    });

    it('never creates a person when the login fails', async () => {
      const begun = await service.begin('/');
      await failsWith(begun.flowToken, CALLBACK('forged'));
      expect(users.users.size).toBe(0);
    });
  });
});

describe('LoginService.endSessionUrl', () => {
  it('gives the provider address', async () => {
    expect(await service.endSessionUrl()).toBe('http://idp.test/logout');
  });

  it('is null when the provider has none', async () => {
    provider.endSession = null;
    expect(await service.endSessionUrl()).toBeNull();
  });

  it('is null, not an error, when the provider cannot be reached (logging out must still work)', async () => {
    provider.failEndSession = true;
    expect(await service.endSessionUrl()).toBeNull();
  });
});

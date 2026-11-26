import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashToken, newOpaqueToken } from '../../../src/auth/opaque-token';
import { SessionService, TOUCH_INTERVAL_MS } from '../../../src/auth/session.service';
import { FakeClock, InMemorySessionRepository } from '../../support/fakes';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const config = { session: { ttlMs: 24 * HOUR, idleMs: 2 * HOUR } };

let clock: FakeClock;
let repo: InMemorySessionRepository;
let service: SessionService;

beforeEach(() => {
  clock = new FakeClock();
  repo = new InMemorySessionRepository();
  service = new SessionService(repo, config, clock);
});

describe('SessionService.create', () => {
  it('returns a token, and stores only its hash', async () => {
    const { token } = await service.create('user-1');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...repo.rows.keys()]).toEqual([hashToken(token)]);
    expect(JSON.stringify([...repo.rows.values()])).not.toContain(token);
  });

  it('expires at login time plus the lifetime', async () => {
    const { expiresAt } = await service.create('user-1');
    expect(expiresAt.getTime()).toBe(clock.now().getTime() + 24 * HOUR);
  });

  it('gives a different token each time, even for the same person', async () => {
    const a = await service.create('user-1');
    const b = await service.create('user-1');
    expect(a.token).not.toBe(b.token);
    expect(repo.rows.size).toBe(2);
  });
});

describe('SessionService.authenticate', () => {
  it('recognises a valid token', async () => {
    const { token } = await service.create('user-1');
    expect(await service.authenticate(token)).toEqual({ userId: 'user-1', sessionId: hashToken(token) });
  });

  it('does not recognise a token that was never issued', async () => {
    expect(await service.authenticate(newOpaqueToken())).toBeNull();
  });

  it('does not touch the database for something that cannot be a token', async () => {
    const find = vi.spyOn(repo, 'find');
    for (const junk of [undefined, null, '', 'abc', 42, {}, 'a'.repeat(10_000)]) expect(await service.authenticate(junk)).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it('does not accept the stored hash as if it were the token', async () => {
    const { token } = await service.create('user-1');
    expect(await service.authenticate(hashToken(token))).toBeNull();
  });

  describe('absolute lifetime', () => {
    it('is valid until the last millisecond before expiry', async () => {
      const { token } = await service.create('user-1');
      clock.advance(24 * HOUR - 1);
      // keep it from going idle meanwhile
      const stillThere = new SessionService(repo, { session: { ttlMs: 24 * HOUR, idleMs: 24 * HOUR } }, clock);
      expect(await stillThere.authenticate(token)).not.toBeNull();
    });

    it('ends exactly at expiry, and the session is removed', async () => {
      const long = new SessionService(repo, { session: { ttlMs: 24 * HOUR, idleMs: 24 * HOUR } }, clock);
      const { token } = await long.create('user-1');
      clock.advance(24 * HOUR);
      expect(await long.authenticate(token)).toBeNull();
      expect(repo.rows.size).toBe(0);
    });

    it('is not extended by use', async () => {
      const { token } = await service.create('user-1');
      for (let i = 0; i < 23; i++) {
        clock.advance(HOUR);
        expect(await service.authenticate(token)).not.toBeNull(); // used every hour: never idle
      }
      clock.advance(HOUR);
      expect(await service.authenticate(token)).toBeNull(); // 24 h after the login, whatever happened
    });
  });

  describe('idle time', () => {
    it('is valid one millisecond before the idle limit', async () => {
      const { token } = await service.create('user-1');
      clock.advance(2 * HOUR - 1);
      expect(await service.authenticate(token)).not.toBeNull();
    });

    it('ends exactly at the idle limit, and the session is removed', async () => {
      const { token } = await service.create('user-1');
      clock.advance(2 * HOUR);
      expect(await service.authenticate(token)).toBeNull();
      expect(repo.rows.size).toBe(0);
    });

    it('a request moves the idle window', async () => {
      const { token } = await service.create('user-1');
      clock.advance(90 * MINUTE);
      expect(await service.authenticate(token)).not.toBeNull();
      clock.advance(90 * MINUTE); // 3 h after login, but only 90 min after the last use
      expect(await service.authenticate(token)).not.toBeNull();
    });
  });

  describe('"last seen" writes', () => {
    it('does not write on every request', async () => {
      const touch = vi.spyOn(repo, 'touch');
      const { token } = await service.create('user-1');
      for (let i = 0; i < 20; i++) {
        clock.advance(1000);
        await service.authenticate(token);
      }
      expect(touch).not.toHaveBeenCalled();
    });

    it('writes once the interval has passed, and then waits again', async () => {
      const touch = vi.spyOn(repo, 'touch');
      const { token } = await service.create('user-1');
      clock.advance(TOUCH_INTERVAL_MS - 1);
      await service.authenticate(token);
      expect(touch).not.toHaveBeenCalled();
      clock.advance(1);
      await service.authenticate(token);
      expect(touch).toHaveBeenCalledTimes(1);
      clock.advance(TOUCH_INTERVAL_MS - 1);
      await service.authenticate(token);
      expect(touch).toHaveBeenCalledTimes(1);
    });

    it('is not written for an expired session', async () => {
      const touch = vi.spyOn(repo, 'touch');
      const { token } = await service.create('user-1');
      clock.advance(3 * HOUR);
      await service.authenticate(token);
      expect(touch).not.toHaveBeenCalled();
    });
  });
});

describe('SessionService.revoke and the rest', () => {
  it('revoke ends the session', async () => {
    const { token } = await service.create('user-1');
    await service.revoke(token);
    expect(await service.authenticate(token)).toBeNull();
  });

  it('revoke twice, with junk, or with nothing is harmless and touches nothing else', async () => {
    const { token } = await service.create('user-1');
    const other = await service.create('user-2');
    await service.revoke(token);
    for (const junk of [token, undefined, null, '', 'abc', 42]) await expect(service.revoke(junk)).resolves.toBeUndefined();
    expect(await service.authenticate(other.token)).not.toBeNull();
  });

  it('revokeAllFor ends every login of that person and only theirs', async () => {
    const a1 = await service.create('user-1');
    const a2 = await service.create('user-1');
    const b = await service.create('user-2');
    expect(await service.revokeAllFor('user-1')).toBe(2);
    expect(await service.authenticate(a1.token)).toBeNull();
    expect(await service.authenticate(a2.token)).toBeNull();
    expect(await service.authenticate(b.token)).not.toBeNull();
  });

  it('purgeExpired removes sessions past their lifetime and keeps the others', async () => {
    const old = await service.create('user-1');
    clock.advance(25 * HOUR);
    const fresh = await service.create('user-2');
    expect(await service.purgeExpired()).toBe(1);
    expect(repo.rows.has(hashToken(old.token))).toBe(false);
    expect(repo.rows.has(hashToken(fresh.token))).toBe(true);
  });
});

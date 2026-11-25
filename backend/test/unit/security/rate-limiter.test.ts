import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_TRACKED_KEYS, RateLimiter } from '../../../src/security/rate-limiter';
import { FakeClock } from '../../support/fakes';

let clock: FakeClock;
let limiter: RateLimiter;
beforeEach(() => {
  clock = new FakeClock();
  limiter = new RateLimiter(clock);
});

describe('RateLimiter', () => {
  it('allows up to the limit and refuses the next one', () => {
    for (let i = 1; i <= 3; i++) expect(limiter.hit('k', 3, 60_000)).toEqual({ allowed: true, retryAfterSeconds: 0, remaining: 3 - i });
    expect(limiter.hit('k', 3, 60_000)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('says how long to wait, rounded up, and at least one second', () => {
    limiter.hit('k', 1, 60_000);
    clock.advance(1_500);
    expect(limiter.hit('k', 1, 60_000).retryAfterSeconds).toBe(59);
    clock.advance(58_400);
    expect(limiter.hit('k', 1, 60_000).retryAfterSeconds).toBe(1);
    clock.advance(99);
    expect(limiter.hit('k', 1, 60_000).retryAfterSeconds).toBe(1);
  });

  it('opens again exactly when the window ends, not a millisecond before', () => {
    limiter.hit('k', 1, 1_000);
    clock.advance(999);
    expect(limiter.hit('k', 1, 1_000).allowed).toBe(false);
    clock.advance(1);
    expect(limiter.hit('k', 1, 1_000).allowed).toBe(true);
  });

  it('a refused request does not push the end of the window (hammering does not lock a person out for longer)', () => {
    limiter.hit('k', 1, 10_000);
    for (let i = 0; i < 50; i++) {
      clock.advance(100);
      limiter.hit('k', 1, 10_000);
    }
    clock.advance(5_000);
    expect(limiter.hit('k', 1, 10_000).allowed).toBe(true);
  });

  it('counts each key on its own', () => {
    limiter.hit('a', 1, 60_000);
    expect(limiter.hit('a', 1, 60_000).allowed).toBe(false);
    expect(limiter.hit('b', 1, 60_000).allowed).toBe(true);
  });

  it('a new window starts the count from zero', () => {
    for (let i = 0; i < 5; i++) limiter.hit('k', 5, 1_000);
    clock.advance(1_000);
    expect(limiter.hit('k', 5, 1_000)).toMatchObject({ allowed: true, remaining: 4 });
  });

  it('a limit of zero refuses everything', () => {
    expect(limiter.hit('k', 0, 1_000).allowed).toBe(false);
  });

  it('keys that look like each other are different keys', () => {
    limiter.hit('sign-in|1.2.3.4', 1, 60_000);
    expect(limiter.hit('sign-in|1.2.3.45', 1, 60_000).allowed).toBe(true);
    expect(limiter.hit('sign-in|1.2.3.4 ', 1, 60_000).allowed).toBe(true);
  });

  it('does not grow without limit when a flood comes from many addresses', () => {
    for (let i = 0; i < MAX_TRACKED_KEYS + 500; i++) limiter.hit(`ip-${i}`, 5, 60_000);
    expect(limiter.size).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
  });

  it('sweeps out windows that ended before dropping live ones', () => {
    for (let i = 0; i < MAX_TRACKED_KEYS; i++) limiter.hit(`old-${i}`, 5, 1_000);
    clock.advance(2_000);
    limiter.hit('fresh', 1, 60_000);
    expect(limiter.size).toBe(1);
    expect(limiter.hit('fresh', 1, 60_000).allowed).toBe(false);
  });

  it('when it is full of live windows the oldest go first and the newest keep counting (a known limit, written in the threat model)', () => {
    for (let i = 0; i < MAX_TRACKED_KEYS; i++) limiter.hit(`ip-${i}`, 1, 60_000);
    limiter.hit('newest', 1, 60_000);
    expect(limiter.size).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
    expect(limiter.hit('newest', 1, 60_000).allowed).toBe(false);
  });
});

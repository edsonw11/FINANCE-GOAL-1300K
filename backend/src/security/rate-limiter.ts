import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../clock';

export interface RateLimitVerdict {
  readonly allowed: boolean;
  /** Seconds until the window ends (what `Retry-After` says), at least 1 when refused; 0 when allowed. */
  readonly retryAfterSeconds: number;
  readonly remaining: number;
}

interface Window {
  readonly endsAt: number;
  count: number;
}

/** Counters older than this many keys trigger a sweep, so a flood of different addresses cannot grow memory without limit. */
export const MAX_TRACKED_KEYS = 50_000;

/**
 * A fixed-window counter per key, in memory. One instance of the API counts for itself: behind several instances the limit is per instance
 * (the real fix is a shared store, noted in the threat model). Time comes from the injected clock, so tests move it instead of waiting.
 */
@Injectable()
export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /** Counts one request for `key`: allowed while the window has room. A refused request does not extend the window. */
  hit(key: string, limit: number, windowMs: number): RateLimitVerdict {
    const now = this.clock.now().getTime();
    if (this.windows.size >= MAX_TRACKED_KEYS) this.sweep(now);
    let window = this.windows.get(key);
    if (!window || window.endsAt <= now) {
      window = { endsAt: now + windowMs, count: 0 };
      this.windows.set(key, window);
    }
    if (window.count >= limit) return { allowed: false, retryAfterSeconds: Math.ceil((window.endsAt - now) / 1000), remaining: 0 };
    window.count += 1;
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - window.count };
  }

  /** How many keys are being counted (for tests and diagnosis). */
  get size(): number {
    return this.windows.size;
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) if (window.endsAt <= now) this.windows.delete(key);
    // still full of live windows: drop the oldest, a flood must not make the process run out of memory
    if (this.windows.size >= MAX_TRACKED_KEYS) {
      const excess = this.windows.size - MAX_TRACKED_KEYS + 1;
      let dropped = 0;
      for (const key of this.windows.keys()) {
        this.windows.delete(key);
        if (++dropped >= excess) break;
      }
    }
  }
}

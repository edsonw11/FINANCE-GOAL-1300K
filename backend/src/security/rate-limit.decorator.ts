import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT = 'everfox:rateLimit';
export const SKIP_RATE_LIMIT = 'everfox:skipRateLimit';

export interface RateLimitPolicy {
  /** Counted together: routes with the same name share one allowance. */
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
  /** Who is counted: the network address (also for people not signed in), or the signed-in person wherever they connect from. */
  readonly by: 'address' | 'person';
}

/** A stricter allowance for a route. */
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT, policy);

/** The browser app's own files and the health checks are not counted (one page load asks for a hundred files). */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT, true);

/** What every request is held to, per address, unless a route says otherwise: generous, to stop floods and not people. */
export const DEFAULT_POLICY: RateLimitPolicy = { name: 'default', limit: 1200, windowMs: 60_000, by: 'address' };

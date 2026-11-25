import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import '../auth/request-auth';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { DEFAULT_POLICY, RATE_LIMIT, type RateLimitPolicy, SKIP_RATE_LIMIT } from './rate-limit.decorator';
import { RateLimiter } from './rate-limiter';

export class TooManyRequests extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too Many Requests', retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

function enforce(limiter: RateLimiter, key: string, policy: RateLimitPolicy, factor: number, reply: FastifyReply): true {
  const verdict = limiter.hit(`${policy.name}|${key}`, policy.limit * factor, policy.windowMs);
  if (verdict.allowed) return true;
  void reply.header('retry-after', String(verdict.retryAfterSeconds));
  throw new TooManyRequests(verdict.retryAfterSeconds);
}

/**
 * Runs BEFORE the login check, so requests without a login are counted too (floods of wrong cookies and login attempts cost database work).
 * Counted per network address: a route's own policy, or the generous default for everything else.
 */
@Injectable()
export class AddressRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'rateLimitFactor'>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(SKIP_RATE_LIMIT, targets)) return true;
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT, targets);
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    // a route counted per person still gets the generous address allowance here; its own count comes after the login check
    return enforce(this.limiter, request.ip, policy?.by === 'address' ? policy : DEFAULT_POLICY, this.config.rateLimitFactor, http.getResponse<FastifyReply>());
  }
}

/** Runs AFTER the login check: routes marked `by: 'person'` are counted per person, whatever address they come from (a phone changing network keeps its count). */
@Injectable()
export class PersonRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'rateLimitFactor'>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT, [context.getHandler(), context.getClass()]);
    if (policy?.by !== 'person') return true;
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    if (!request.auth) return true; // a route nobody signs in for has nothing to count per person
    return enforce(this.limiter, request.auth.userId, policy, this.config.rateLimitFactor, http.getResponse<FastifyReply>());
  }
}

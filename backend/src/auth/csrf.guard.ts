import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { type FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

/** A request that changes something must carry this header with this value. A form on another site cannot add it. */
export const CSRF_HEADER = 'x-everfox-csrf';
export const CSRF_VALUE = '1';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protects cookie logins from forged requests: anything that is not a plain read must come from our own origin
 * (the Origin header, which a page on another site cannot fake) and carry the header above. SameSite=Lax on the cookie is the third layer.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'appBaseUrl'>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    if (request.headers.origin !== this.config.appBaseUrl) throw new ForbiddenException();
    if (request.headers[CSRF_HEADER] !== CSRF_VALUE) throw new ForbiddenException();
    return true;
  }
}

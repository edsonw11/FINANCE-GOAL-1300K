import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { IS_PUBLIC } from './public.decorator';
import './request-auth';
import { SessionService } from './session.service';

/** Global and deny-by-default: no valid session cookie, no access, unless the route is marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'cookies'>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const { sessionName, secure } = this.config.cookies;
    const cookie = request.cookies?.[sessionName];
    const session = await this.sessions.authenticate(cookie);
    if (!session) {
      // a cookie that no longer works is removed, so the browser stops sending it
      if (cookie !== undefined) http.getResponse<FastifyReply>().clearCookie(sessionName, { path: '/', httpOnly: true, sameSite: 'lax', secure });
      throw new UnauthorizedException();
    }
    request.auth = session;
    return true;
  }
}

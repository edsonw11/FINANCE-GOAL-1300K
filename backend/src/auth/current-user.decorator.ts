import { type ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { type FastifyRequest } from 'fastify';
import './request-auth';
import { type AuthenticatedSession } from './session.service';

/** The logged-in person of this request. Throws 401 on a route that forgot authentication (it never returns undefined). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedSession => {
  const auth = context.switchToHttp().getRequest<FastifyRequest>().auth;
  if (!auth) throw new UnauthorizedException();
  return auth;
});

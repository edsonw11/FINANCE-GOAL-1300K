import { type AuthenticatedSession } from './session.service';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the authentication guard on every route that is not public. */
    auth?: AuthenticatedSession;
  }
}

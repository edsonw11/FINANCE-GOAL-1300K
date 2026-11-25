import { Controller, Get, HttpCode, Inject, Logger, Post, Query, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { LoginService } from './login.service';
import { LoginFailedError } from './oidc-provider';
import { CALLBACK_PATH } from './openid-client.provider';
import { Public } from './public.decorator';
import { SessionService } from './session.service';
import { RateLimit } from '../security/rate-limit.decorator';

/** Where the browser lands when the login failed for any reason. The reason stays in the server log. */
export const LOGIN_FAILED_PATH = '/?login=failed';

/** Starting and finishing a login share one allowance per address: 20 a minute is far more than a person needs and far less than a script. */
const SIGN_IN_LIMIT = { name: 'sign-in', limit: 20, windowMs: 60_000, by: 'address' } as const;

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly login: LoginService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'cookies' | 'appBaseUrl'>,
  ) {}

  /** Starts the login: remembers the attempt in a short cookie and sends the browser to the identity provider. */
  @Public()
  @RateLimit(SIGN_IN_LIMIT)
  @Get('login')
  async start(@Query('returnTo') returnTo: unknown, @Res() reply: FastifyReply): Promise<void> {
    const { flowName, secure } = this.config.cookies;
    let begun;
    try {
      begun = await this.login.begin(returnTo);
    } catch (error) {
      this.logger.error(`Could not start a login: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('Login is not available right now');
    }
    reply
      .setCookie(flowName, begun.flowToken, { httpOnly: true, sameSite: 'lax', secure, path: '/', expires: begun.flowExpiresAt })
      .redirect(begun.authorizationUrl, 302);
  }

  /** The identity provider sends the person back here with a code. */
  @Public()
  @RateLimit(SIGN_IN_LIMIT)
  @Get('callback')
  async finish(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const { flowName, sessionName, secure } = this.config.cookies;
    const cookieOptions = { httpOnly: true, sameSite: 'lax', secure, path: '/' } as const;
    // only the query string of the request is used: the address itself comes from the configuration, never from request headers
    const queryStart = request.url.indexOf('?');
    const callbackUrl = new URL(CALLBACK_PATH + (queryStart >= 0 ? request.url.slice(queryStart) : ''), this.config.appBaseUrl);

    let done;
    try {
      done = await this.login.complete(request.cookies?.[flowName], callbackUrl);
    } catch (error) {
      if (!(error instanceof LoginFailedError)) throw error;
      this.logger.warn(`Login failed: ${error.reason}`);
      reply.clearCookie(flowName, cookieOptions).redirect(new URL(LOGIN_FAILED_PATH, this.config.appBaseUrl).href, 302);
      return;
    }
    // a login always gets a new session; one that was still open on this browser ends
    await this.sessions.revoke(request.cookies?.[sessionName]);
    reply
      .clearCookie(flowName, cookieOptions)
      .setCookie(sessionName, done.sessionToken, { ...cookieOptions, expires: done.sessionExpiresAt })
      .redirect(new URL(done.returnTo, this.config.appBaseUrl).href, 302);
  }

  /** Ends the login here and says where to go to end it at the identity provider too (otherwise the next login is silent). */
  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<{ endSessionUrl: string | null }> {
    const { sessionName, secure } = this.config.cookies;
    await this.sessions.revoke(request.cookies?.[sessionName]);
    reply.clearCookie(sessionName, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
    return { endSessionUrl: await this.login.endSessionUrl() };
  }
}

import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { type AppConfig } from './config/app-config';
import { nestLogLevels } from './logging/nest-log-levels';

/** Requests larger than this are refused (413) before the application reads them. */
export const BODY_LIMIT_BYTES = 1024 * 1024;

/** The HTTP server and its limits (a function of its own so the limits can be tested on their behaviour). */
export function createAdapter(): FastifyAdapter {
  // trustProxy stays off until a proxy is configured on purpose: a spoofed X-Forwarded-For must not pick the client address
  return new FastifyAdapter({ bodyLimit: BODY_LIMIT_BYTES, trustProxy: false });
}

/**
 * What every application needs besides its modules: reading cookies, and never letting a browser or a proxy keep an
 * answer (they carry personal data or decide about a login). Tests that build their own app call this too.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  await app.register(fastifyCookie);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (_request, reply, payload) => {
      reply.header('cache-control', 'no-store');
      return payload;
    });
}

/** Builds the application (not listening yet): main.ts listens, tests call app.inject(). */
export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), createAdapter(), {
    logger: nestLogLevels(config.logLevel),
  });
  // signals are handled by registerGracefulShutdown (main.ts), not by Nest's enableShutdownHooks
  await configureApp(app);
  return app;
}

import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll } from 'vitest';
import { AppModule } from '../../src/app.module';
import { OIDC_PROVIDER } from '../../src/auth/oidc-provider';
import { configureApp, createAdapter } from '../../src/create-app';
import { deviceSyncContract } from '../contracts/device-sync.contract';
import { FakeOidcProvider } from '../support/fakes';
import { testConfig, withClient } from './support';

// The browser's sync code against the whole application on the real PostgreSQL: only the identity provider is scripted.
const ISSUER = 'http://idp.test/devices';
let app: NestFastifyApplication;
const provider = new FakeOidcProvider();
const config = testConfig();
const cleanup = () => withClient((c) => c.query('DELETE FROM app_user WHERE oidc_issuer = $1', [ISSUER]));

beforeAll(async () => {
  await cleanup();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).overrideProvider(OIDC_PROVIDER).useValue(provider).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(), { logger: false });
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterAll(async () => {
  await app?.close();
  await cleanup();
});

const cookieOf = (headers: Record<string, unknown>, name: string) => {
  const v = headers['set-cookie'];
  return (Array.isArray(v) ? (v as string[]) : [String(v)]).find((c) => c.startsWith(`${name}=`))?.split(';')[0];
};
// logins share the scripted provider, so they go one at a time
let queue: Promise<unknown> = Promise.resolve();
function login(subject: string): Promise<string> {
  const run = queue.then(async () => {
    provider.identity = { issuer: ISSUER, subject, email: `${subject}@example.test`, displayName: subject };
    const start = await app.inject({ method: 'GET', url: '/auth/login' });
    const flow = cookieOf(start.headers, config.cookies.flowName)!;
    const back = await app.inject({ method: 'GET', url: provider.callbackFor(), headers: { cookie: flow } });
    return cookieOf(back.headers, config.cookies.sessionName)!;
  });
  queue = run.catch(() => undefined);
  return run;
}

deviceSyncContract('PostgreSQL', async () => ({ app, login }));

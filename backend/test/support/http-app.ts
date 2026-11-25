import { type TestingModule, Test } from '@nestjs/testing';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ACCOUNT_REPOSITORY } from '../../src/accounts/account.repository';
import { AUTH_FLOW_REPOSITORY } from '../../src/auth/auth-flow.repository';
import { OIDC_PROVIDER } from '../../src/auth/oidc-provider';
import { SESSION_REPOSITORY } from '../../src/auth/session.repository';
import { CLOCK } from '../../src/clock';
import { loadConfig } from '../../src/config/load-config';
import { type AppConfig } from '../../src/config/app-config';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { configureApp, createAdapter } from '../../src/create-app';
import { MUTATION_LOG } from '../../src/sync/mutation-log';
import { USER_REPOSITORY } from '../../src/users/user.repository';
import { baseEnv } from './env';
import { FakeClock, FakeOidcProvider, InMemoryAccountRepository, InMemoryAuthFlowRepository, InMemoryMutationLog, InMemorySessionRepository, InMemoryUserRepository } from './fakes';

export const ORIGIN = 'http://localhost:3000';
export const CSRF = { origin: ORIGIN, 'x-everfox-csrf': '1' } as const;

export interface TestApp {
  readonly app: NestFastifyApplication;
  readonly config: AppConfig;
  readonly clock: FakeClock;
  readonly provider: FakeOidcProvider;
  readonly sessions: InMemorySessionRepository;
  readonly flows: InMemoryAuthFlowRepository;
  readonly users: InMemoryUserRepository;
  readonly accounts: InMemoryAccountRepository;
  readonly mutationLog: InMemoryMutationLog;
  /** Logs in through the real routes as the person the fake provider currently describes; returns the Cookie header value. */
  login(returnTo?: string): Promise<string>;
  close(): Promise<void>;
}

/** The whole HTTP application (real controllers, guards, services) with in-memory storage and a scripted identity provider. */
export async function createTestApp(env: Record<string, string | undefined> = {}): Promise<TestApp> {
  const config = loadConfig({ ...baseEnv(), NODE_ENV: 'test', LOG_LEVEL: 'silent', ...env } as NodeJS.ProcessEnv);
  const clock = new FakeClock();
  const provider = new FakeOidcProvider();
  const sessions = new InMemorySessionRepository();
  const flows = new InMemoryAuthFlowRepository();
  const users = new InMemoryUserRepository();
  const accounts = new InMemoryAccountRepository();
  const mutationLog = new InMemoryMutationLog();
  const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(OIDC_PROVIDER)
    .useValue(provider)
    .overrideProvider(SESSION_REPOSITORY)
    .useValue(sessions)
    .overrideProvider(AUTH_FLOW_REPOSITORY)
    .useValue(flows)
    .overrideProvider(USER_REPOSITORY)
    .useValue(users)
    .overrideProvider(ACCOUNT_REPOSITORY)
    .useValue(accounts)
    .overrideProvider(MUTATION_LOG)
    .useValue(mutationLog)
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(), { logger: false });
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const cookieOf = (setCookie: string | string[] | undefined, name: string): string | undefined => {
    const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const line = list.find((c) => c.startsWith(`${name}=`));
    return line?.split(';')[0];
  };

  return {
    app,
    config,
    clock,
    provider,
    sessions,
    flows,
    users,
    accounts,
    mutationLog,
    async login(returnTo = '/') {
      const start = await app.inject({ method: 'GET', url: `/auth/login?returnTo=${encodeURIComponent(returnTo)}` });
      const flow = cookieOf(start.headers['set-cookie'], config.cookies.flowName);
      if (!flow) throw new Error('login did not set the flow cookie');
      const back = await app.inject({ method: 'GET', url: provider.callbackFor(), headers: { cookie: flow } });
      const session = cookieOf(back.headers['set-cookie'], config.cookies.sessionName);
      if (!session) throw new Error(`login did not set the session cookie (status ${back.statusCode})`);
      return session;
    },
    close: () => app.close(),
  };
}

import { describe, expect, it, vi } from 'vitest';
import { ConfigError } from '../../../src/config/config-error';
import { DEV_APP_DATABASE_PASSWORD, DEV_DATABASE_PASSWORD } from '../../../src/config/env.schema';
import { loadConfig } from '../../../src/config/load-config';
import { OIDC_DEV, OIDC_PROD } from '../../support/env';

const DB = 'postgresql://app:s3cret-pw@db.internal:5432/everfox';
const env = (extra: Record<string, string | undefined> = {}) => ({ DATABASE_URL: DB, ...OIDC_DEV, ...extra });

/** The variables named in the error (what the operator is told to fix). */
function problemsOf(input: Record<string, string | undefined>) {
  try {
    loadConfig(input);
  } catch (e) {
    if (e instanceof ConfigError) return e.issues;
    throw e;
  }
  return null;
}

describe('loadConfig: defaults and valid values', () => {
  it('needs only DATABASE_URL and fills the rest with safe defaults', () => {
    expect(loadConfig(env())).toEqual({
      nodeEnv: 'development',
      host: '127.0.0.1', // loopback by default: the container sets HOST=0.0.0.0 on purpose
      port: 3000,
      logLevel: 'info',
      healthCheckTimeoutMs: 2000,
      databaseUrl: DB,
      appBaseUrl: 'http://localhost:3000',
      oidc: { issuer: OIDC_DEV.OIDC_ISSUER, internalUrl: null, clientId: 'everfox-web', clientSecret: OIDC_DEV.OIDC_CLIENT_SECRET },
      session: { ttlMs: 168 * 3_600_000, idleMs: 4320 * 60_000 },
      cookies: { secure: false, sessionName: 'everfox_session', flowName: 'everfox_login' },
      rateLimitFactor: 1,
    });
  });

  it('RATE_LIMIT_FACTOR loosens the request limits outside production only, and only with a whole number from 1', () => {
    expect(loadConfig(env({ RATE_LIMIT_FACTOR: '50' })).rateLimitFactor).toBe(50);
    for (const bad of ['0', '-1', '1.5', 'abc', '', '100001']) expect(() => loadConfig(env({ RATE_LIMIT_FACTOR: bad })), bad).toThrow(/RATE_LIMIT_FACTOR/);
    expect(() => loadConfig(env({ ...OIDC_PROD, NODE_ENV: 'production', RATE_LIMIT_FACTOR: '2' }))).toThrow(/RATE_LIMIT_FACTOR.*production/s);
    expect(loadConfig(env({ ...OIDC_PROD, NODE_ENV: 'production', RATE_LIMIT_FACTOR: '1' })).rateLimitFactor).toBe(1);
  });

  it('reads every variable and turns the numbers into numbers', () => {
    const config = loadConfig(
      env({ ...OIDC_PROD, NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '8080', LOG_LEVEL: 'warn', HEALTH_CHECK_TIMEOUT_MS: '500' }),
    );
    expect(config).toMatchObject({ nodeEnv: 'production', host: '0.0.0.0', port: 8080, logLevel: 'warn', healthCheckTimeoutMs: 500 });
    expect(typeof config.port).toBe('number');
  });

  it.each(['development', 'test', 'production'])('accepts NODE_ENV=%s', (value) => {
    expect(loadConfig(env({ ...(value === 'production' ? OIDC_PROD : {}), NODE_ENV: value })).nodeEnv).toBe(value);
  });

  it.each(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])('accepts LOG_LEVEL=%s', (value) => {
    expect(loadConfig(env({ LOG_LEVEL: value })).logLevel).toBe(value);
  });

  it.each(['postgresql://u:p@h/db', 'postgres://u:p@h/db', 'POSTGRESQL://u:p@h/db', 'postgresql://h/db?sslmode=require'])(
    'accepts DATABASE_URL %s',
    (url) => {
      expect(loadConfig(env({ DATABASE_URL: url })).databaseUrl).toBe(url);
    },
  );

  it('ignores variables it does not know (PATH, HOME, ...)', () => {
    expect(loadConfig(env({ PATH: '/usr/bin', HOME: '/root', SOMETHING_ELSE: 'x' }))).not.toHaveProperty('PATH');
  });

  it('treats a variable that is set to undefined as not set', () => {
    expect(loadConfig(env({ PORT: undefined, NODE_ENV: undefined })).port).toBe(3000);
  });

  it('returns a frozen object: nobody changes the configuration while the API runs', () => {
    const config = loadConfig(env());
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as { port: number }).port = 1;
    }).toThrow(TypeError);
  });

  it('only reads the object it is given, never process.env', () => {
    vi.stubEnv('DATABASE_URL', DB);
    expect(() => loadConfig({})).toThrow(ConfigError);
  });
});

describe('loadConfig: PORT', () => {
  it.each(['1', '80', '3000', '65535', '08080'])('accepts %s', (value) => {
    expect(loadConfig(env({ PORT: value })).port).toBe(Number(value));
  });

  it.each(['0', '65536', '-1', 'abc', '3000.5', '3e3', ' 3000', '3000 ', '0x10', '', '+80', '99999999999999999999', 'NaN', 'Infinity'])(
    'rejects %j',
    (value) => {
      expect(problemsOf(env({ PORT: value }))?.map((i) => i.variable)).toEqual(['PORT']);
    },
  );
});

describe('loadConfig: what the message says for a number', () => {
  const messageFor = (value: string) => problemsOf(env({ PORT: value }))?.map((i) => i.problem);

  it.each(['', 'abc', '3000.5', '-1', ' 3000'])('%j is "not a whole number", not a range problem', (value) => {
    expect(messageFor(value)).toEqual(['PORT must be a whole number']);
  });

  it('too small and too big say which side', () => {
    expect(messageFor('0')).toEqual(['PORT must be at least 1']);
    expect(messageFor('65536')).toEqual(['PORT must be at most 65535']);
  });

  it('a huge number gives one message, not two', () => {
    expect(messageFor('99999999999999999999')).toEqual(['PORT must be at most 65535']);
  });
});

describe('loadConfig: HEALTH_CHECK_TIMEOUT_MS', () => {
  it.each([['50'], ['2000'], ['30000']])('accepts %s', (value) => {
    expect(loadConfig(env({ HEALTH_CHECK_TIMEOUT_MS: value })).healthCheckTimeoutMs).toBe(Number(value));
  });

  it.each([['49'], ['30001'], ['0'], ['-5'], ['1.5'], ['fast'], ['']])('rejects %j', (value) => {
    expect(problemsOf(env({ HEALTH_CHECK_TIMEOUT_MS: value }))?.map((i) => i.variable)).toEqual(['HEALTH_CHECK_TIMEOUT_MS']);
  });
});

describe('loadConfig: NODE_ENV, LOG_LEVEL and HOST', () => {
  it.each(['staging', 'PRODUCTION', 'Production', 'prod', ''])('rejects NODE_ENV=%j (exact names only)', (value) => {
    expect(problemsOf(env({ NODE_ENV: value }))?.map((i) => i.variable)).toEqual(['NODE_ENV']);
  });

  it.each(['verbose', 'INFO', 'log', 'all', ''])('rejects LOG_LEVEL=%j', (value) => {
    expect(problemsOf(env({ LOG_LEVEL: value }))?.map((i) => i.variable)).toEqual(['LOG_LEVEL']);
  });

  it('rejects an empty HOST (listening on "" is not a decision anyone made)', () => {
    expect(problemsOf(env({ HOST: '' }))?.map((i) => i.variable)).toEqual(['HOST']);
  });
});

describe('loadConfig: DATABASE_URL', () => {
  it('is required', () => {
    expect(problemsOf({ ...OIDC_DEV })).toEqual([{ variable: 'DATABASE_URL', problem: 'DATABASE_URL is required' }]);
  });

  it.each([
    ['empty', ''],
    ['another database', 'mysql://u:p@h/db'],
    ['no scheme', 'localhost:5432/db'],
    ['plain text', 'not a url'],
    ['http', 'https://example.com/db'],
    ['scheme only inside', 'x-postgresql://h/db'],
    ['leading space', ' postgresql://h/db'],
  ])('rejects %s', (_label, url) => {
    expect(problemsOf(env({ DATABASE_URL: url }))?.map((i) => i.variable)).toEqual(['DATABASE_URL']);
  });

  it('says one thing per problem, not two for the same variable', () => {
    expect(problemsOf(env({ DATABASE_URL: 'mysql://u:p@h/db' }))).toHaveLength(1);
    expect(problemsOf(env({ DATABASE_URL: 'postgresql://exa mple/db' }))).toHaveLength(1);
  });
});

describe('loadConfig: production', () => {
  const prod = (url: string) => env({ ...OIDC_PROD, NODE_ENV: 'production', DATABASE_URL: url });

  it('refuses the local password of the data-only role too', () => {
    expect(problemsOf(prod(`postgresql://everfox_app:${DEV_APP_DATABASE_PASSWORD}@db/everfox`))).toEqual([
      { variable: 'DATABASE_URL', problem: expect.stringContaining('development password') },
    ]);
  });

  it('refuses the local development database password', () => {
    expect(problemsOf(prod(`postgresql://everfox:${DEV_DATABASE_PASSWORD}@db/everfox`))).toEqual([
      { variable: 'DATABASE_URL', problem: expect.stringContaining('development password') },
    ]);
  });

  it('refuses it even written with percent-encoding', () => {
    expect(problemsOf(prod('postgresql://everfox:everfox%5Fdev%5Fonly@db/everfox'))).not.toBeNull();
    expect(problemsOf(prod('postgresql://everfox:%65verfox_dev_only@db/everfox'))).not.toBeNull();
  });

  it('accepts a different password', () => {
    expect(loadConfig(prod('postgresql://everfox:another-secret@db/everfox')).nodeEnv).toBe('production');
  });

  it('accepts a URL with no password at all (the platform may authenticate another way)', () => {
    expect(loadConfig(prod('postgresql://everfox@db/everfox')).nodeEnv).toBe('production');
  });

  it('does not break on a broken percent sequence in the password', () => {
    expect(loadConfig(prod('postgresql://everfox:100%25sure%@db/everfox')).nodeEnv).toBe('production');
  });

  it.each(['development', 'test'])('still allows the development password in %s', (nodeEnv) => {
    expect(loadConfig(env({ NODE_ENV: nodeEnv, DATABASE_URL: `postgresql://everfox:${DEV_DATABASE_PASSWORD}@127.0.0.1/everfox` })).nodeEnv).toBe(nodeEnv);
  });

  it('a dev password in a user name or database name is not the password', () => {
    expect(loadConfig(prod(`postgresql://${DEV_DATABASE_PASSWORD}:real-secret@db/${DEV_DATABASE_PASSWORD}`)).nodeEnv).toBe('production');
  });
});

describe('loadConfig: the error', () => {
  it('reports every problem at once, in one message', () => {
    const error = (() => {
      try {
        loadConfig({ PORT: 'abc', NODE_ENV: 'staging' });
      } catch (e) {
        return e as ConfigError;
      }
      throw new Error('should have thrown');
    })();
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.name).toBe('ConfigError');
    const names = ['APP_BASE_URL', 'DATABASE_URL', 'NODE_ENV', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_ISSUER', 'PORT'];
    expect(error.issues.map((i) => i.variable).sort()).toEqual(names);
    for (const name of names) expect(error.message).toContain(name);
  });

  it('never repeats a received value, because DATABASE_URL carries a password', () => {
    const secrets = ['SuperSecret123', 'secret-port-value', 'secret-level', 'secret-env', 'shortsecret'];
    const input = {
      DATABASE_URL: `mysql://admin:${secrets[0]}@h/db`,
      PORT: secrets[1],
      LOG_LEVEL: secrets[2],
      NODE_ENV: secrets[3],
      HEALTH_CHECK_TIMEOUT_MS: 'secret-timeout',
      OIDC_CLIENT_SECRET: 'shortsecret',
      OIDC_ISSUER: 'ftp://user:pw-in-url@idp/realm',
      APP_BASE_URL: 'http://localhost:3000',
      OIDC_CLIENT_ID: 'everfox-web',
    };
    const error = (() => {
      try {
        loadConfig(input);
      } catch (e) {
        return e as ConfigError;
      }
      throw new Error('should have thrown');
    })();
    const everything = error.message + JSON.stringify(error.issues);
    for (const secret of [...secrets, 'secret-timeout', 'mysql://', 'admin', 'pw-in-url', 'ftp://']) expect(everything).not.toContain(secret);
  });

  it('does not repeat the password when production refuses it either', () => {
    const issues = problemsOf(env({ NODE_ENV: 'production', DATABASE_URL: `postgresql://u:${DEV_DATABASE_PASSWORD}@h/db` }));
    expect(JSON.stringify(issues)).not.toContain(DEV_DATABASE_PASSWORD);
  });
});

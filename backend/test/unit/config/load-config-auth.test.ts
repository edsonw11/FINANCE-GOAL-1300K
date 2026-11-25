import { describe, expect, it } from 'vitest';
import { ConfigError } from '../../../src/config/config-error';
import { DEV_OIDC_CLIENT_SECRET } from '../../../src/config/env.schema';
import { loadConfig } from '../../../src/config/load-config';
import { OIDC_PROD, baseEnv } from '../../support/env';

const issuesOf = (input: Record<string, string | undefined>) => {
  try {
    loadConfig(input);
  } catch (e) {
    if (e instanceof ConfigError) return e.issues;
    throw e;
  }
  return null;
};
const variablesOf = (input: Record<string, string | undefined>) => issuesOf(input)?.map((i) => i.variable);
const prod = (extra: Record<string, string | undefined> = {}) => baseEnv({ ...OIDC_PROD, NODE_ENV: 'production', DATABASE_URL: 'postgresql://app:real-pw@db/everfox', ...extra });

describe('login settings are required', () => {
  it.each(['APP_BASE_URL', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'])('%s', (name) => {
    expect(issuesOf(baseEnv({ [name]: undefined }))).toEqual([{ variable: name, problem: `${name} is required` }]);
  });

  it.each(['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'])('%s cannot be empty', (name) => {
    expect(variablesOf(baseEnv({ [name]: '' }))).toEqual([name]);
  });

  it('has no way to run without login: nothing makes the settings optional', () => {
    expect(variablesOf({ DATABASE_URL: 'postgresql://u:p@h/db' })).toEqual(['APP_BASE_URL', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET']);
  });
});

describe('APP_BASE_URL', () => {
  it.each([
    ['http://localhost:3000', 'http://localhost:3000'],
    ['https://app.example.com', 'https://app.example.com'],
    ['https://app.example.com/', 'https://app.example.com'],
    ['HTTPS://APP.EXAMPLE.COM', 'https://app.example.com'],
    ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080'],
  ])('accepts %s and keeps only the origin (%s)', (value, origin) => {
    expect(loadConfig(baseEnv({ APP_BASE_URL: value })).appBaseUrl).toBe(origin);
  });

  it.each(['https://app.example.com/app', 'https://app.example.com/?x=1', 'https://app.example.com/#top', 'ftp://app.example.com', 'app.example.com', 'not a url', 'https://user:pw@app.example.com', 'javascript:alert(1)'])(
    'rejects %j',
    (value) => {
      expect(variablesOf(baseEnv({ APP_BASE_URL: value }))).toEqual(['APP_BASE_URL']);
    },
  );
});

describe('OIDC_ISSUER and OIDC_INTERNAL_URL', () => {
  it('keeps the issuer exactly as written (token issuers are compared as text)', () => {
    expect(loadConfig(baseEnv({ OIDC_ISSUER: 'https://login.example.com/realms/everfox' })).oidc.issuer).toBe('https://login.example.com/realms/everfox');
    expect(loadConfig(baseEnv({ OIDC_ISSUER: 'https://login.example.com/' })).oidc.issuer).toBe('https://login.example.com/');
  });

  it.each(['ftp://idp/realm', 'idp/realm', 'https://idp/realm?x=1', 'https://idp/realm#a', 'https://u:p@idp/realm'])('rejects issuer %j', (value) => {
    expect(variablesOf(baseEnv({ OIDC_ISSUER: value }))).toEqual(['OIDC_ISSUER']);
  });

  it('the internal address is optional and defaults to none', () => {
    expect(loadConfig(baseEnv()).oidc.internalUrl).toBeNull();
    expect(loadConfig(baseEnv({ OIDC_INTERNAL_URL: 'http://keycloak:8080/realms/everfox' })).oidc.internalUrl).toBe('http://keycloak:8080/realms/everfox');
  });

  it.each(['keycloak:8080', 'http://keycloak:8080/realms/x?y=1', 'file:///etc/passwd'])('rejects internal address %j', (value) => {
    expect(variablesOf(baseEnv({ OIDC_INTERNAL_URL: value }))).toEqual(['OIDC_INTERNAL_URL']);
  });
});

describe('OIDC_CLIENT_SECRET', () => {
  it('needs at least 16 characters', () => {
    expect(variablesOf(baseEnv({ OIDC_CLIENT_SECRET: 'a'.repeat(15) }))).toEqual(['OIDC_CLIENT_SECRET']);
    expect(loadConfig(baseEnv({ OIDC_CLIENT_SECRET: 'a'.repeat(16) })).oidc.clientSecret).toBe('a'.repeat(16));
  });

  it('is not repeated in the message when it is too short', () => {
    expect(JSON.stringify(issuesOf(baseEnv({ OIDC_CLIENT_SECRET: 'tiny-secret' })))).not.toContain('tiny-secret');
  });
});

describe('session lifetime', () => {
  it('turns hours and minutes into milliseconds', () => {
    expect(loadConfig(baseEnv({ SESSION_TTL_HOURS: '2', SESSION_IDLE_MINUTES: '30' })).session).toEqual({ ttlMs: 7_200_000, idleMs: 1_800_000 });
  });

  it.each([['0'], ['2161'], ['-1'], ['1.5'], ['abc'], ['']])('SESSION_TTL_HOURS rejects %j', (value) => {
    expect(variablesOf(baseEnv({ SESSION_TTL_HOURS: value }))).toEqual(['SESSION_TTL_HOURS']);
  });

  it.each([['4'], ['43201'], ['0'], ['x'], ['']])('SESSION_IDLE_MINUTES rejects %j', (value) => {
    expect(variablesOf(baseEnv({ SESSION_IDLE_MINUTES: value }))).toEqual(['SESSION_IDLE_MINUTES']);
  });

  it('accepts the limits', () => {
    expect(loadConfig(baseEnv({ SESSION_TTL_HOURS: '2160', SESSION_IDLE_MINUTES: '5' })).session.ttlMs).toBe(2160 * 3_600_000);
    expect(loadConfig(baseEnv({ SESSION_TTL_HOURS: '1', SESSION_IDLE_MINUTES: '60' })).session.idleMs).toBe(3_600_000);
  });

  it('refuses an idle limit longer than the absolute one (it would never apply)', () => {
    expect(variablesOf(baseEnv({ SESSION_TTL_HOURS: '1', SESSION_IDLE_MINUTES: '61' }))).toEqual(['SESSION_IDLE_MINUTES']);
  });
});

describe('cookies', () => {
  it('are plain outside production (http://localhost has no TLS)', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(loadConfig(baseEnv({ NODE_ENV: nodeEnv })).cookies).toEqual({ secure: false, sessionName: 'everfox_session', flowName: 'everfox_login' });
    }
  });

  it('are Secure and take the __Host- prefix in production (no Domain, path /, https only)', () => {
    expect(loadConfig(prod()).cookies).toEqual({ secure: true, sessionName: '__Host-everfox_session', flowName: '__Host-everfox_login' });
  });
});

describe('production rules for login', () => {
  it('accepts a correct production setup', () => {
    expect(loadConfig(prod()).nodeEnv).toBe('production');
  });

  it('refuses the development client secret', () => {
    expect(issuesOf(prod({ OIDC_CLIENT_SECRET: DEV_OIDC_CLIENT_SECRET }))).toEqual([{ variable: 'OIDC_CLIENT_SECRET', problem: expect.stringContaining('development secret') }]);
  });

  it('refuses http for the app and for the issuer', () => {
    expect(variablesOf(prod({ APP_BASE_URL: 'http://app.example.com' }))).toEqual(['APP_BASE_URL']);
    expect(variablesOf(prod({ OIDC_ISSUER: 'http://login.example.com/realms/everfox' }))).toEqual(['OIDC_ISSUER']);
  });

  it('reports all production problems together', () => {
    expect(variablesOf(prod({ APP_BASE_URL: 'http://a.example.com', OIDC_ISSUER: 'http://l.example.com/r', OIDC_CLIENT_SECRET: DEV_OIDC_CLIENT_SECRET, DATABASE_URL: 'postgresql://u:everfox_dev_only@h/db' })))
      .toEqual(['DATABASE_URL', 'OIDC_CLIENT_SECRET', 'APP_BASE_URL', 'OIDC_ISSUER']);
  });

  it('does not repeat the development secret in the message', () => {
    expect(JSON.stringify(issuesOf(prod({ OIDC_CLIENT_SECRET: DEV_OIDC_CLIENT_SECRET })))).not.toContain(DEV_OIDC_CLIENT_SECRET);
  });

  it('allows http and the development secret outside production', () => {
    expect(loadConfig(baseEnv({ NODE_ENV: 'development' })).oidc.clientSecret).toBe(DEV_OIDC_CLIENT_SECRET);
  });

  it('keeps the config deeply frozen', () => {
    const config = loadConfig(prod());
    expect(Object.isFrozen(config.oidc) && Object.isFrozen(config.session) && Object.isFrozen(config.cookies)).toBe(true);
  });
});

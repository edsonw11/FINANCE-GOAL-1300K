import { DEV_OIDC_CLIENT_SECRET } from '../../src/config/env.schema';

/** The login settings of the local setup (docker compose Keycloak on 8081, the API on 3000). Valid outside production. */
export const OIDC_DEV = {
  APP_BASE_URL: 'http://localhost:3000',
  OIDC_ISSUER: 'http://localhost:8081/realms/everfox',
  OIDC_CLIENT_ID: 'everfox-web',
  OIDC_CLIENT_SECRET: DEV_OIDC_CLIENT_SECRET,
};

/** The same settings as a production deployment would have them (https, a real secret). */
export const OIDC_PROD = {
  APP_BASE_URL: 'https://app.example.com',
  OIDC_ISSUER: 'https://login.example.com/realms/everfox',
  OIDC_CLIENT_ID: 'everfox-web',
  OIDC_CLIENT_SECRET: 'a-long-random-production-secret',
};

export const DATABASE_URL_EXAMPLE = 'postgresql://app:s3cret-pw@db.internal:5432/everfox';

/** A complete valid environment; pass overrides (undefined removes a variable). */
export const baseEnv = (extra: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
  DATABASE_URL: DATABASE_URL_EXAMPLE,
  ...OIDC_DEV,
  ...extra,
});

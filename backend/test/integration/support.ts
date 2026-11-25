import { Client } from 'pg';
import { type AppConfig } from '../../src/config/app-config';
import { loadConfig } from '../../src/config/load-config';
import { OIDC_DEV } from '../support/env';

/** The database of the integration tests. Fails loudly (not "skipped") when it is not there: a green run must mean something. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Start the database (docker compose up -d db), run `npm run db:migrate`, and copy .env.example to .env.');
  }
  return url;
}

export const testConfig = (overrides: Record<string, string> = {}): AppConfig =>
  loadConfig({ ...OIDC_DEV, DATABASE_URL: databaseUrl(), NODE_ENV: 'test', LOG_LEVEL: 'silent', RATE_LIMIT_FACTOR: '1000', ...overrides });

/** A URL for the same database with another password (the user exists, the password is wrong). */
export function withPassword(url: string, password: string): string {
  const changed = new URL(url);
  changed.password = password;
  return changed.toString();
}

/** A URL for the same server with another database name. */
export function withDatabase(url: string, name: string): string {
  const changed = new URL(url);
  changed.pathname = `/${name}`;
  return changed.toString();
}

/** A plain pg connection, independent of Prisma, to look at the database the way an operator would. */
export async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

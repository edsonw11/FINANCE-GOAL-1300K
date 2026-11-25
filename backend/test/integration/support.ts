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

/** The owner of the database (migrations, table lists, checks about the data-only role). Falls back to DATABASE_URL when no separate owner is set. */
export const adminDatabaseUrl = (): string => process.env.MIGRATE_DATABASE_URL ?? databaseUrl();

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
export async function withClient<T>(fn: (client: Client) => Promise<T>, connectionString: string = databaseUrl()): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The same, as the database owner: for what the data-only role is not allowed to look at (the migration history, other roles, the table list). */
export const withAdminClient = <T>(fn: (client: Client) => Promise<T>): Promise<T> => withClient(fn, adminDatabaseUrl());

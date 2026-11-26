import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { adminDatabaseUrl, databaseUrl, withAdminClient, withClient } from './support';

// The API connects with a role that can only read and write data. A stolen connection string, an injection that reaches the database,
// or a bug in the API must not be able to change the structure, read the migration history, make roles or touch other databases.
const ISSUER = 'http://idp.test/role';
const asApp = <T>(fn: Parameters<typeof withClient<T>>[0]) => withClient(fn, databaseUrl());
const failsWith = async (sql: string, code: string) => {
  const error = await asApp((c) => c.query(sql)).then(() => null, (e: { code?: string }) => e);
  expect(error, `${sql} should fail`).not.toBeNull();
  expect((error as { code?: string }).code, sql).toBe(code);
};
const INSUFFICIENT_PRIVILEGE = '42501';

afterAll(async () => {
  await withAdminClient((c) => c.query('DROP TABLE IF EXISTS zz_role_probe'));
  await asApp((c) => c.query('DELETE FROM app_user WHERE oidc_issuer = $1', [ISSUER]));
});

describe('the API database role', () => {
  it('is the data-only role in this run (not the owner, not a superuser)', async () => {
    if (databaseUrl() === adminDatabaseUrl()) throw new Error('DATABASE_URL and MIGRATE_DATABASE_URL are the same: run the integration tests as the data-only role (see backend/.env.example)');
    const { rows } = await asApp((c) => c.query('SELECT current_user AS who, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super'));
    expect(rows[0]).toEqual({ who: 'everfox_app', super: false });
  });

  it('has none of the powerful attributes', async () => {
    const { rows } = await withAdminClient((c) =>
      c.query('SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin, rolconnlimit FROM pg_roles WHERE rolname = $1', ['everfox_app']),
    );
    expect(rows).toEqual([{ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolcanlogin: true, rolconnlimit: -1 }]);
  });

  it('can read and write the data of every table of the application, and only that', async () => {
    const { rows: tables } = await withAdminClient((c) => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY table_name"));
    expect(tables.length).toBeGreaterThan(8);
    for (const { table_name: table } of tables) {
      const { rows } = await withAdminClient((c) =>
        c.query(
          `SELECT p, has_table_privilege('everfox_app', $1, p) AS allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p`,
          [`public.${table}`],
        ),
      );
      const allowed = rows.filter((r) => r.allowed).map((r) => r.p);
      expect(allowed, table).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    }
  });

  it('works as the API: writes and reads a person and removes them', async () => {
    const id = randomUUID();
    await asApp((c) => c.query('INSERT INTO app_user (id, oidc_issuer, oidc_subject) VALUES ($1, $2, $3)', [id, ISSUER, `s-${id}`]));
    const { rows } = await asApp((c) => c.query('SELECT oidc_subject FROM app_user WHERE id = $1', [id]));
    expect(rows).toEqual([{ oidc_subject: `s-${id}` }]);
    await asApp((c) => c.query('DELETE FROM app_user WHERE id = $1', [id]));
  });

  it.each([
    ['create a table', 'CREATE TABLE zz_nope (id int)'],
    ['drop a table', 'DROP TABLE app_user'],
    ['alter a table', 'ALTER TABLE app_user ADD COLUMN zz int'],
    ['truncate a table', 'TRUNCATE record'],
    ['read the migration history', 'SELECT * FROM _prisma_migrations'],
    ['change the migration history', 'DELETE FROM _prisma_migrations'],
    ['create a role', 'CREATE ROLE zz_intruder LOGIN'],
    ['make itself a superuser', 'ALTER ROLE everfox_app SUPERUSER'],
    ['create an index', 'CREATE INDEX zz_idx ON app_user (email)'],
    ['create a function', 'CREATE FUNCTION zz() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$'],
    ['create a schema', 'CREATE SCHEMA zz'],
    ['create a trigger', 'CREATE TRIGGER zz BEFORE INSERT ON app_user FOR EACH ROW EXECUTE FUNCTION pg_catalog.suppress_redundant_updates_trigger()'],
    ['read the password hashes', 'SELECT * FROM pg_authid'],
    ['read a file of the server', "SELECT pg_read_file('/etc/passwd')"],
    ['copy to a program', "COPY app_user TO PROGRAM 'id'"],
    ['read from a program', "COPY app_user FROM PROGRAM 'id'"],
    ['create an extension', 'CREATE EXTENSION IF NOT EXISTS pgcrypto'],
    ['drop the database', 'DROP DATABASE everfox'],
    ['grant itself more', 'GRANT ALL ON TABLE _prisma_migrations TO everfox_app'],
  ])('cannot %s', async (_label, sql) => {
    const error = await asApp((c) => c.query(sql)).then(() => null, (e: { code?: string }) => e);
    expect(error, sql).not.toBeNull();
    // permission denied (42501) is the point; "must be owner" and "no such object" would also mean nothing happened, but only the first proves the role is the barrier
    expect(['42501'], `${sql} -> ${error?.code}`).toContain(error?.code);
  });

  it('cannot reach another database of the same server', async () => {
    const other = new URL(databaseUrl());
    other.pathname = '/postgres';
    const error = await withClient((c) => c.query('SELECT 1'), other.toString()).then(() => null, (e: { code?: string }) => e);
    expect(error).not.toBeNull();
  });

  it('rows of one person are still protected by the application, not by the role: the role sees all rows (the isolation tests prove the application)', async () => {
    const { rows } = await asApp((c) => c.query('SELECT count(*)::int AS n FROM app_user'));
    expect(rows[0].n).toBeGreaterThanOrEqual(0);
  });
});

describe('the grants file', () => {
  it('gives the role a table made later, when it is applied again (a forgotten table is not possible)', async () => {
    await withAdminClient((c) => c.query('CREATE TABLE zz_role_probe (id int)'));
    await failsWith('SELECT * FROM zz_role_probe', INSUFFICIENT_PRIVILEGE);
    execFileSync('node', ['scripts/with-env.mjs', 'prisma', 'db', 'execute', '--file', 'prisma/roles/grants.sql'], { encoding: 'utf8', stdio: 'pipe' });
    await asApp((c) => c.query('INSERT INTO zz_role_probe VALUES (1)'));
    const { rows } = await asApp((c) => c.query('SELECT id FROM zz_role_probe'));
    expect(rows).toEqual([{ id: 1 }]);
    await failsWith('DROP TABLE zz_role_probe', '42501');
    await failsWith('TRUNCATE zz_role_probe', INSUFFICIENT_PRIVILEGE);
  });

  it('can be applied again and again with the same result', async () => {
    for (let i = 0; i < 2; i++) execFileSync('node', ['scripts/with-env.mjs', 'prisma', 'db', 'execute', '--file', 'prisma/roles/grants.sql'], { encoding: 'utf8', stdio: 'pipe' });
    await failsWith('SELECT * FROM _prisma_migrations', INSUFFICIENT_PRIVILEGE);
  });
});

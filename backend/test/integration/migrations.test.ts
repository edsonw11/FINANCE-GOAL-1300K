import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { UUID_V7, withClient } from './support';

const created: string[] = [];
afterEach(async () => {
  if (!created.length) return;
  await withClient((c) => c.query('DELETE FROM app_user WHERE id = ANY($1::uuid[])', [created.splice(0)]));
});

describe('migrations', () => {
  it('has applied every migration completely, in order', async () => {
    const { rows } = await withClient((c) =>
      c.query('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name'),
    );
    expect(rows.map((r) => r.migration_name)).toEqual(['20261124000000_create_app_user', '20261125000000_identity_sessions_accounts']);
    for (const row of rows) {
      expect(row.finished_at).not.toBeNull();
      expect(row.rolled_back_at).toBeNull();
    }
  });

  it('can be applied again with nothing to do', () => {
    const out = execFileSync('node', ['scripts/with-env.mjs', 'prisma', 'migrate', 'deploy'], { encoding: 'utf8', stdio: 'pipe' });
    expect(out).toContain('No pending migrations to apply');
  });

  it('left only the tables we expect in the public schema', async () => {
    const { rows } = await withClient((c) =>
      c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"),
    );
    expect(rows.map((r) => r.table_name)).toEqual(['_prisma_migrations', 'account', 'app_user', 'auth_flow', 'session']);
  });
});

describe('table app_user', () => {
  it('has exactly the columns we designed', async () => {
    const { rows } = await withClient((c) =>
      c.query(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'app_user' ORDER BY column_name`,
      ),
    );
    expect(rows).toEqual([
      { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'display_name', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'email', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'last_login_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'oidc_issuer', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'oidc_subject', data_type: 'text', is_nullable: 'NO' },
    ]);

  });

  it('has the id as primary key', async () => {
    const { rows } = await withClient((c) =>
      c.query(
        `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = 'app_user'::regclass AND i.indisprimary`,
      ),
    );
    expect(rows.map((r) => r.attname)).toEqual(['id']);
  });

  it('gives a new row a version 7 uuid and the current time', async () => {
    const before = Date.now();
    const { rows } = await withClient((c) =>
      c.query("INSERT INTO app_user (oidc_issuer, oidc_subject) VALUES ('http://idp.test/migrations', $1) RETURNING id, created_at", [randomUUID()]),
    );
    created.push(rows[0].id);
    expect(rows[0].id).toMatch(UUID_V7);
    expect(Math.abs(rows[0].created_at.getTime() - before)).toBeLessThan(10_000);
  });

  it('gives many rows different ids, in the order they were created', async () => {
    const { rows } = await withClient((c) =>
      c.query("INSERT INTO app_user (oidc_issuer, oidc_subject) SELECT 'http://idp.test/migrations', gen_random_uuid()::text FROM generate_series(1, 50) RETURNING id"),
    );
    const ids: string[] = rows.map((r) => r.id);
    created.push(...ids);
    expect(new Set(ids).size).toBe(50);
    expect([...ids].sort()).toEqual(ids);
  });

  it('refuses an id that is not a uuid', async () => {
    await expect(
      withClient((c) => c.query("INSERT INTO app_user (id, oidc_issuer, oidc_subject) VALUES ('not-a-uuid', 'i', 's')")),
    ).rejects.toThrow(/invalid input syntax for type uuid/);
  });

  it('refuses a row without an identity', async () => {
    await expect(withClient((c) => c.query('INSERT INTO app_user DEFAULT VALUES'))).rejects.toThrow(/null value/);
  });
});

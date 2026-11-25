import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/plans/features';
import { withClient } from './support';

// What the database refuses by itself, whatever the application does.
const ISSUER = 'http://idp.test/schema-rules';
const cleanup = () => withClient((c) => c.query('DELETE FROM app_user WHERE oidc_issuer = $1', [ISSUER]));
beforeAll(cleanup);
afterAll(cleanup);

const newUser = async (): Promise<string> =>
  (await withClient((c) => c.query('INSERT INTO app_user (oidc_issuer, oidc_subject) VALUES ($1, $2) RETURNING id', [ISSUER, randomUUID()]))).rows[0].id;
const rejects = (sql: string, params: unknown[], pattern: RegExp) => expect(withClient((c) => c.query(sql, params))).rejects.toThrow(pattern);

describe('app_user', () => {
  it('refuses an empty issuer or subject', async () => {
    await rejects("INSERT INTO app_user (oidc_issuer, oidc_subject) VALUES ('', 'x')", [], /app_user_identity_not_empty/);
    await rejects("INSERT INTO app_user (oidc_issuer, oidc_subject) VALUES ($1, '')", [ISSUER], /app_user_identity_not_empty/);
  });

  it('refuses the same (issuer, subject) twice, and accepts the same subject at another issuer', async () => {
    const subject = randomUUID();
    await withClient((c) => c.query('INSERT INTO app_user (oidc_issuer, oidc_subject) VALUES ($1, $2)', [ISSUER, subject]));
    await rejects('INSERT INTO app_user (oidc_issuer, oidc_subject) VALUES ($1, $2)', [ISSUER, subject], /duplicate key/);
    await withClient((c) => c.query('INSERT INTO app_user (oidc_issuer, oidc_subject) VALUES ($1, $2)', [`${ISSUER}/other`, subject]));
    await withClient((c) => c.query('DELETE FROM app_user WHERE oidc_issuer = $1', [`${ISSUER}/other`]));
  });

  it('does not make the e-mail unique (two people may share one; it is never an identity)', async () => {
    await withClient((c) => c.query('INSERT INTO app_user (oidc_issuer, oidc_subject, email) VALUES ($1, $2, $3), ($1, $4, $3)', [ISSUER, randomUUID(), 'same@example.test', randomUUID()]));
  });
});

describe('session', () => {
  it('needs an existing person', async () => {
    await rejects("INSERT INTO session (id_hash, user_id, expires_at) VALUES ('h', $1, now() + interval '1 hour')", [randomUUID()], /foreign key/);
  });

  it('must expire after it was created', async () => {
    const user = await newUser();
    await rejects("INSERT INTO session (id_hash, user_id, created_at, expires_at) VALUES ('h2', $1, now(), now() - interval '1 second')", [user], /session_expires_after_creation/);
    await rejects('INSERT INTO session (id_hash, user_id, created_at, expires_at) VALUES (\'h3\', $1, now(), now())', [user], /session_expires_after_creation/);
  });

  it('disappears with the person', async () => {
    const user = await newUser();
    await withClient((c) => c.query("INSERT INTO session (id_hash, user_id, expires_at) VALUES ($2, $1, now() + interval '1 hour')", [user, `cascade-${user}`]));
    await withClient((c) => c.query('DELETE FROM app_user WHERE id = $1', [user]));
    const { rows } = await withClient((c) => c.query('SELECT 1 FROM session WHERE id_hash = $1', [`cascade-${user}`]));
    expect(rows).toHaveLength(0);
  });
});

describe('account', () => {
  it('needs an existing owner', async () => {
    await rejects("INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, 'x', 1)", [randomUUID(), randomUUID()], /foreign key/);
  });

  it('refuses an empty or too long name', async () => {
    const user = await newUser();
    await rejects("INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, '', 1)", [randomUUID(), user], /account_name_length/);
    await rejects('INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, $3, 1)', [randomUUID(), user, 'a'.repeat(81)], /account_name_length/);
    await withClient((c) => c.query('INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, $3, 1)', [randomUUID(), user, 'a'.repeat(80)]));
  });

  it('refuses an id that is not a uuid, and a repeated id', async () => {
    const user = await newUser();
    await rejects("INSERT INTO account (id, user_id, name, version) VALUES ('nope', $1, 'x', 1)", [user], /invalid input syntax for type uuid/);
    const id = randomUUID();
    await withClient((c) => c.query("INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, 'x', 1)", [id, user]));
    await rejects("INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, 'y', 1)", [id, user], /duplicate key/);
  });

  it('is deleted with its owner, and only with its owner', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const [ida, idb] = [randomUUID(), randomUUID()];
    await withClient((c) => c.query("INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, 'a', 1), ($3, $4, 'b', 1)", [ida, a, idb, b]));
    await withClient((c) => c.query('DELETE FROM app_user WHERE id = $1', [a]));
    const { rows } = await withClient((c) => c.query('SELECT id FROM account WHERE id = ANY($1::uuid[])', [[ida, idb]]));
    expect(rows.map((r) => r.id)).toEqual([idb]);
  });
});

describe('sync tables', () => {
  it('a record must have a positive version', async () => {
    const user = await newUser();
    await rejects("INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, 'x', 0)", [randomUUID(), user], /account_version_positive/);
    await rejects("INSERT INTO account (id, user_id, name, version) VALUES ($1, $2, 'x', -3)", [randomUUID(), user], /account_version_positive/);
    await rejects("INSERT INTO account (id, user_id, name) VALUES ($1, $2, 'x')", [randomUUID(), user], /null value/);
  });

  it('the change counter cannot go negative and needs an existing person', async () => {
    const user = await newUser();
    await rejects('INSERT INTO sync_cursor (user_id, last_version) VALUES ($1, -1)', [user], /sync_cursor_not_negative/);
    await rejects('INSERT INTO sync_cursor (user_id, last_version) VALUES ($1, 0)', [randomUUID()], /foreign key/);
  });

  it('a mutation is remembered once per person, and needs an existing person', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const mutation = randomUUID();
    const sql = "INSERT INTO sync_mutation (user_id, mutation_id, outcome) VALUES ($1, $2, '{}')";
    await withClient((c) => c.query(sql, [a, mutation]));
    await rejects(sql, [a, mutation], /duplicate key/);
    await withClient((c) => c.query(sql, [b, mutation]));
    await rejects(sql, [randomUUID(), randomUUID()], /foreign key/);
  });
});

describe('plans', () => {
  it('starts with free and pro, free having no gated feature and pro having every one the code knows', async () => {
    const { rows } = await withClient((c) => c.query('SELECT plan_id, feature_key FROM plan_feature ORDER BY plan_id, feature_key'));
    expect(rows.filter((r) => r.plan_id === 'free')).toEqual([]);
    expect(rows.filter((r) => r.plan_id === 'pro').map((r) => r.feature_key)).toEqual(['budgets.advanced', 'import.bank-files', 'investments.projection', 'report.monthly']);
  });

  it('every feature the database gives to a plan is in the code catalogue (a typo in a migration would lock nobody out silently)', async () => {
    const { rows } = await withClient((c) => c.query('SELECT DISTINCT feature_key FROM plan_feature'));
    const known = new Set<string>(FEATURES);
    expect(rows.map((r) => r.feature_key).filter((k: string) => !k.startsWith('contract.') && !known.has(k))).toEqual([]);
  });

  it('a new person is on free and is not an administrator', async () => {
    const id = await newUser();
    const { rows } = await withClient((c) => c.query('SELECT plan_id, is_admin FROM app_user WHERE id = $1', [id]));
    expect(rows).toEqual([{ plan_id: 'free', is_admin: false }]);
  });

  it('a person cannot be put on a plan that does not exist, and a plan in use cannot be deleted', async () => {
    const id = await newUser();
    await rejects('UPDATE app_user SET plan_id = $2 WHERE id = $1', [id, 'ghost'], /foreign key/);
    await withClient((c) => c.query("UPDATE app_user SET plan_id = 'pro' WHERE id = $1", [id]));
    await rejects("DELETE FROM plan WHERE id = 'pro'", [], /foreign key/);
  });

  it('refuses malformed plan ids and feature keys', async () => {
    await rejects("INSERT INTO plan (id, name) VALUES ('Bad Id', 'x')", [], /plan_id_format/);
    await rejects("INSERT INTO plan (id, name) VALUES ('ok', '')", [], /plan_name_length/);
    await rejects("INSERT INTO plan_feature (plan_id, feature_key) VALUES ('free', 'Has Spaces')", [], /plan_feature_key_format/);
    await rejects("INSERT INTO plan_feature (plan_id, feature_key) VALUES ('ghost', 'ok.key')", [], /foreign key/);
  });

  it('keeps the audit history when the person who acted is deleted', async () => {
    const id = await newUser();
    const { rows } = await withClient((c) => c.query("INSERT INTO audit_log (actor_user_id, action, target) VALUES ($1, 'test.action', 'plan:free') RETURNING id", [id]));
    await withClient((c) => c.query('DELETE FROM app_user WHERE id = $1', [id]));
    const after = await withClient((c) => c.query('SELECT actor_user_id FROM audit_log WHERE id = $1', [rows[0].id]));
    expect(after.rows).toEqual([{ actor_user_id: null }]);
    await withClient((c) => c.query('DELETE FROM audit_log WHERE id = $1', [rows[0].id]));
  });
});

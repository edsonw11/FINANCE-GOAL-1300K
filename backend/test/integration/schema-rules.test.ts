import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
    await rejects("INSERT INTO account (id, user_id, name) VALUES ($1, $2, 'x')", [randomUUID(), randomUUID()], /foreign key/);
  });

  it('refuses an empty or too long name', async () => {
    const user = await newUser();
    await rejects("INSERT INTO account (id, user_id, name) VALUES ($1, $2, '')", [randomUUID(), user], /account_name_length/);
    await rejects('INSERT INTO account (id, user_id, name) VALUES ($1, $2, $3)', [randomUUID(), user, 'a'.repeat(81)], /account_name_length/);
    await withClient((c) => c.query('INSERT INTO account (id, user_id, name) VALUES ($1, $2, $3)', [randomUUID(), user, 'a'.repeat(80)]));
  });

  it('refuses an id that is not a uuid, and a repeated id', async () => {
    const user = await newUser();
    await rejects("INSERT INTO account (id, user_id, name) VALUES ('nope', $1, 'x')", [user], /invalid input syntax for type uuid/);
    const id = randomUUID();
    await withClient((c) => c.query("INSERT INTO account (id, user_id, name) VALUES ($1, $2, 'x')", [id, user]));
    await rejects("INSERT INTO account (id, user_id, name) VALUES ($1, $2, 'y')", [id, user], /duplicate key/);
  });

  it('is deleted with its owner, and only with its owner', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const [ida, idb] = [randomUUID(), randomUUID()];
    await withClient((c) => c.query("INSERT INTO account (id, user_id, name) VALUES ($1, $2, 'a'), ($3, $4, 'b')", [ida, a, idb, b]));
    await withClient((c) => c.query('DELETE FROM app_user WHERE id = $1', [a]));
    const { rows } = await withClient((c) => c.query('SELECT id FROM account WHERE id = ANY($1::uuid[])', [[ida, idb]]));
    expect(rows.map((r) => r.id)).toEqual([idb]);
  });
});

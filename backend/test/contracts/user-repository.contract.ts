import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type OidcIdentity } from '../../src/auth/oidc-provider';
import { type UserRepository } from '../../src/users/user.repository';

const T0 = new Date('2026-11-25T12:00:00.000Z');

/** What every UserRepository must do. Unique issuer per test: the shared database keeps other people's rows. */
export function userRepositoryContract(label: string, make: () => Promise<UserRepository>) {
  const identity = (over: Partial<OidcIdentity> = {}): OidcIdentity => ({
    issuer: `http://idp.test/${randomUUID()}`,
    subject: 'sub-1',
    email: 'a@example.test',
    displayName: 'A',
    ...over,
  });

  describe(`UserRepository contract: ${label}`, () => {
    it('creates a person the first time and finds the same one afterwards', async () => {
      const repository = await make();
      const who = identity();
      const first = await repository.upsertFromIdentity(who, T0);
      const second = await repository.upsertFromIdentity(who, new Date(T0.getTime() + 1000));
      expect(second.id).toBe(first.id);
      expect(first).toEqual({ id: expect.any(String), email: 'a@example.test', displayName: 'A' });
    });

    it('refreshes the e-mail and the name from the provider', async () => {
      const repository = await make();
      const who = identity();
      const first = await repository.upsertFromIdentity(who, T0);
      const changed = await repository.upsertFromIdentity({ ...who, email: 'new@example.test', displayName: 'New Name' }, T0);
      expect(changed).toEqual({ id: first.id, email: 'new@example.test', displayName: 'New Name' });
      expect(await repository.findById(first.id)).toEqual(changed);
    });

    it('accepts a provider that gives no e-mail or name', async () => {
      const repository = await make();
      const user = await repository.upsertFromIdentity(identity({ email: null, displayName: null }), T0);
      expect(user).toMatchObject({ email: null, displayName: null });
    });

    it('is never matched by e-mail: the same e-mail with another subject is another person', async () => {
      const repository = await make();
      const base = identity();
      const a = await repository.upsertFromIdentity(base, T0);
      const b = await repository.upsertFromIdentity({ ...base, subject: 'sub-2' }, T0);
      expect(b.id).not.toBe(a.id);
    });

    it('the same subject at another issuer is another person', async () => {
      const repository = await make();
      const a = await repository.upsertFromIdentity(identity(), T0);
      const b = await repository.upsertFromIdentity(identity(), T0);
      expect(b.id).not.toBe(a.id);
    });

    it('creating the same person many times at once gives one person', async () => {
      const repository = await make();
      const who = identity();
      const users = await Promise.all(Array.from({ length: 15 }, () => repository.upsertFromIdentity(who, T0)));
      expect(new Set(users.map((u) => u.id)).size).toBe(1);
    });

    it('findById answers null for an unknown person', async () => {
      const repository = await make();
      expect(await repository.findById(randomUUID())).toBeNull();
    });
  });
}

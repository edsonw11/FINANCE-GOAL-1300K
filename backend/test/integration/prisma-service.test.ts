import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/database/prisma.service';
import { UUID_V7, databaseUrl, withClient, withDatabase, withPassword } from './support';

const opened: PrismaService[] = [];
const open = (url = databaseUrl()) => {
  const service = new PrismaService({ databaseUrl: url });
  opened.push(service);
  return service;
};
afterAll(async () => {
  await Promise.all(opened.map((s) => s.onModuleDestroy()));
});

const created: string[] = [];
const newPerson = () => ({ oidcIssuer: 'http://idp.test/prisma-service', oidcSubject: randomUUID() });
afterEach(async () => {
  if (!created.length) return;
  await withClient((c) => c.query('DELETE FROM app_user WHERE id = ANY($1::uuid[])', [created.splice(0)]));
});

describe('PrismaService with a real database', () => {
  it('pings', async () => {
    await expect(open().ping()).resolves.toBeUndefined();
  });

  it('serves many pings at once through the pool', async () => {
    const service = open();
    await expect(Promise.all(Array.from({ length: 50 }, () => service.ping()))).resolves.toHaveLength(50);
  });

  it('creates and reads a user (id by the database, time by the database)', async () => {
    const service = open();
    const user = await service.appUser.create({ data: newPerson() });
    created.push(user.id);
    expect(user.id).toMatch(UUID_V7);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(Math.abs(user.createdAt.getTime() - Date.now())).toBeLessThan(10_000);
    expect(await service.appUser.findUnique({ where: { id: user.id } })).toEqual(user);
  });

  it('does not find a user that does not exist', async () => {
    expect(await open().appUser.findUnique({ where: { id: '019f0000-0000-7000-8000-000000000000' } })).toBeNull();
  });

  it('refuses a malformed id instead of searching for it', async () => {
    await expect(open().appUser.findUnique({ where: { id: "x'; DROP TABLE app_user; --" } })).rejects.toThrow();
    const { rows } = await withClient((c) => c.query("SELECT to_regclass('public.app_user') AS t"));
    expect(rows[0].t).toBe('app_user');
  });

  it('counts the users it created', async () => {
    const service = open();
    const before = await service.appUser.count();
    const a = await service.appUser.create({ data: newPerson() });
    const b = await service.appUser.create({ data: newPerson() });
    created.push(a.id, b.id);
    expect(await service.appUser.count()).toBe(before + 2);
  });

  it('can query again after being closed (the pool is opened on demand)', async () => {
    const service = open();
    await service.ping();
    await service.onModuleDestroy();
    await expect(service.ping()).resolves.toBeUndefined();
  });

  it('cannot ping with the wrong password', async () => {
    await expect(open(withPassword(databaseUrl(), 'wrong-password-123')).ping()).rejects.toThrow();
  });

  it('cannot ping a database that does not exist', async () => {
    await expect(open(withDatabase(databaseUrl(), 'nope_not_here')).ping()).rejects.toThrow();
  });
});

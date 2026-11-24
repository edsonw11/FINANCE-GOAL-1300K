import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseHealthCheck } from '../../../src/database/database-health-check';
import { PrismaService } from '../../../src/database/prisma.service';

// a port nobody listens on: connecting is refused at once, so these tests need no database
const UNREACHABLE = 'postgresql://app:pw@127.0.0.1:1/everfox';

describe('DatabaseHealthCheck', () => {
  it('is called "database"', () => {
    expect(new DatabaseHealthCheck({ ping: async () => undefined }).name).toBe('database');
  });

  it('passes when the database answers', async () => {
    const ping = vi.fn().mockResolvedValue(undefined);
    await expect(new DatabaseHealthCheck({ ping }).run()).resolves.toBeUndefined();
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('fails with the same error when the database does not answer', async () => {
    const error = new Error('connection refused');
    await expect(new DatabaseHealthCheck({ ping: vi.fn().mockRejectedValue(error) }).run()).rejects.toBe(error);
  });

  it('asks again each time it runs', async () => {
    const ping = vi.fn().mockResolvedValue(undefined);
    const check = new DatabaseHealthCheck({ ping });
    await check.run();
    await check.run();
    expect(ping).toHaveBeenCalledTimes(2);
  });
});

describe('PrismaService', () => {
  const services: PrismaService[] = [];
  const make = (url = UNREACHABLE) => {
    const s = new PrismaService({ databaseUrl: url });
    services.push(s);
    return s;
  };
  afterEach(async () => {
    await Promise.all(services.splice(0).map((s) => s.onModuleDestroy()));
  });

  it('does not connect when it is created: the API can start before the database', () => {
    expect(() => make()).not.toThrow();
  });

  it('ping rejects when the database cannot be reached', async () => {
    await expect(make().ping()).rejects.toThrow();
  });

  it('closes the connection pool when the application shuts down', async () => {
    const service = make();
    const disconnect = vi.spyOn(service, '$disconnect').mockResolvedValue();
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('can be closed without ever having connected', async () => {
    await expect(make().onModuleDestroy()).resolves.toBeUndefined();
  });

  it('does not put the password in the error of a failed ping', async () => {
    const error = await make('postgresql://app:Sup3rSecret@127.0.0.1:1/everfox').ping().catch((e: unknown) => e);
    expect(String(error)).not.toContain('Sup3rSecret');
  });
});

import { type PrismaService } from './prisma.service';

/** What a Prisma client or an open transaction can run. */
export type SqlRunner = Pick<PrismaService, '$queryRaw'>;

/**
 * Takes the person's change counter, and holds it until the transaction ends. Everything a person writes goes through here,
 * so their versions are handed out, and committed, one after the other: a device that has seen version N never misses a lower one.
 */
export async function lockChangeCounter(db: SqlRunner, userId: string): Promise<void> {
  await db.$queryRaw`INSERT INTO sync_cursor (user_id, last_version) VALUES (${userId}::uuid, 0) ON CONFLICT (user_id) DO NOTHING`;
  await db.$queryRaw`SELECT last_version FROM sync_cursor WHERE user_id = ${userId}::uuid FOR UPDATE`;
}

/** The next version of this person. Call it after lockChangeCounter, in the same transaction. */
export async function nextVersion(db: SqlRunner, userId: string): Promise<number> {
  const rows = await db.$queryRaw<{ last_version: bigint }[]>`
    UPDATE sync_cursor SET last_version = last_version + 1 WHERE user_id = ${userId}::uuid RETURNING last_version`;
  const row = rows[0];
  if (!row) throw new Error('the change counter was not locked first');
  return Number(row.last_version);
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { lockChangeCounter, nextVersion } from '../database/sync-version';
import { type AccountChange, type AccountRecord, type AccountRepository, type SaveResult } from './account.repository';

interface AccountRow {
  user_id: string;
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  version: bigint;
}

const fromRow = (row: AccountRow): AccountRecord => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  version: Number(row.version),
});

const toRecord = (row: { id: string; name: string; createdAt: Date; updatedAt: Date; version: bigint }): AccountRecord => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  version: Number(row.version),
});

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AccountRecord[]> {
    const rows = await this.prisma.account.findMany({ where: { userId, deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(toRecord);
  }

  async find(userId: string, id: string): Promise<AccountRecord | null> {
    // the owner is part of the query itself: another person's record is simply not found
    const row = await this.prisma.account.findFirst({ where: { id, userId, deletedAt: null } });
    return row ? toRecord(row) : null;
  }

  async save(userId: string, id: string, name: string, now: Date): Promise<SaveResult> {
    // one transaction under the person's counter lock: two devices, or a retry, cannot interleave
    return this.prisma.$transaction(async (tx): Promise<SaveResult> => {
      await lockChangeCounter(tx, userId);
      const found = await tx.$queryRaw<AccountRow[]>`
        SELECT user_id, id, name, created_at, updated_at, deleted_at, version FROM account WHERE id = ${id}::uuid FOR UPDATE`;
      const existing = found[0];
      if (existing) {
        if (existing.user_id !== userId) return { status: 'taken' };
        if (existing.deleted_at) return { status: 'deleted' };
        if (existing.name === name) return { status: 'saved', account: fromRow(existing) };
        const version = await nextVersion(tx, userId);
        const updated = await tx.$queryRaw<AccountRow[]>`
          UPDATE account SET name = ${name}, updated_at = ${now}, version = ${version}
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
          RETURNING user_id, id, name, created_at, updated_at, deleted_at, version`;
        return { status: 'saved', account: fromRow(updated[0]!) };
      }
      const version = await nextVersion(tx, userId);
      const inserted = await tx.$queryRaw<AccountRow[]>`
        INSERT INTO account (id, user_id, name, created_at, updated_at, version)
        VALUES (${id}::uuid, ${userId}::uuid, ${name}, ${now}, ${now}, ${version})
        ON CONFLICT (id) DO NOTHING
        RETURNING user_id, id, name, created_at, updated_at, deleted_at, version`;
      // nothing inserted: another person created this id a moment ago (it cannot be ours, we hold our own lock)
      return inserted[0] ? { status: 'saved', account: fromRow(inserted[0]) } : { status: 'taken' };
    });
  }

  async remove(userId: string, id: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockChangeCounter(tx, userId);
      const live = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM account WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL FOR UPDATE`;
      if (!live[0]) return;
      const version = await nextVersion(tx, userId);
      await tx.$queryRaw`UPDATE account SET deleted_at = ${now}, updated_at = ${now}, version = ${version} WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
    });
  }

  async changesSince(userId: string, afterVersion: number, limit: number): Promise<AccountChange[]> {
    const rows = await this.prisma.account.findMany({
      where: { userId, version: { gt: BigInt(afterVersion) } },
      orderBy: { version: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({ ...toRecord(row), deleted: row.deletedAt !== null }));
  }
}

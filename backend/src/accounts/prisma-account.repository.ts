import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { type AccountRecord, type AccountRepository, type SaveResult } from './account.repository';

interface AccountRow {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

const toRecord = (row: { id: string; name: string; createdAt: Date; updatedAt: Date }): AccountRecord => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
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
    // one statement, so two devices (or a retry) cannot interleave: it inserts, or updates only the person's own live row
    const rows = await this.prisma.$queryRaw<AccountRow[]>`
      INSERT INTO account (id, user_id, name, created_at, updated_at)
      VALUES (${id}::uuid, ${userId}::uuid, ${name}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
        WHERE account.user_id = EXCLUDED.user_id AND account.deleted_at IS NULL
      RETURNING id, name, created_at, updated_at`;
    const row = rows[0];
    if (row) return { status: 'saved', account: { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at } };
    const existing = await this.prisma.account.findUnique({ where: { id }, select: { userId: true, deletedAt: true } });
    return existing && existing.userId === userId && existing.deletedAt ? { status: 'deleted' } : { status: 'taken' };
  }

  async remove(userId: string, id: string, now: Date): Promise<void> {
    await this.prisma.account.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: now, updatedAt: now } });
  }
}

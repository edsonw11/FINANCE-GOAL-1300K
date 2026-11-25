import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { lockChangeCounter, nextVersion } from '../database/sync-version';
import { type Body, type ImportItem, type ImportResult, type PutInput, type PutResult, type RecordKind, type RecordStore, type StoredRecord, type StoredState } from './record.store';

interface Row {
  id: string;
  user_id: string;
  kind: string;
  legacy_key: string | null;
  position: bigint;
  body: Body;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  version: bigint;
  same?: boolean;
}

const COLUMNS = 'id, user_id, kind, legacy_key, position, body, created_at, updated_at, deleted_at, version';
const RETURNING = `RETURNING ${COLUMNS}`;

const fromRow = (row: Row): StoredRecord => ({
  id: row.id,
  kind: row.kind as RecordKind,
  legacyKey: row.legacy_key,
  position: Number(row.position),
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  version: Number(row.version),
  deleted: row.deleted_at !== null,
});

const IMPORT_CHUNK = 500;

@Injectable()
export class PrismaRecordStore implements RecordStore {
  constructor(private readonly prisma: PrismaService) {}

  async put(userId: string, kind: RecordKind, id: string, input: PutInput, now: Date): Promise<PutResult> {
    const json = JSON.stringify(input.body);
    const merge = input.merge === true;
    return this.prisma.$transaction(async (tx): Promise<PutResult> => {
      await lockChangeCounter(tx, userId);
      const found = await tx.$queryRaw<Row[]>`
        SELECT id, user_id, kind, legacy_key, position, body, created_at, updated_at, deleted_at, version,
               CASE WHEN ${merge} THEN (body || ${json}::jsonb) = body ELSE body = ${json}::jsonb END AS same
          FROM record WHERE id = ${id}::uuid FOR UPDATE`;
      const existing = found[0];
      if (existing) {
        if (existing.user_id !== userId || existing.kind !== kind) return { status: 'taken' };
        if (existing.deleted_at) return { status: 'deleted' };
        const keyChange = input.legacyKey !== undefined && input.legacyKey !== existing.legacy_key;
        if (existing.same && !keyChange) return { status: 'saved', record: fromRow(existing) };
        const key = input.legacyKey === undefined ? existing.legacy_key : input.legacyKey;
        // checked first: a unique violation would abort the whole transaction (we hold this person's lock, so nobody can slip in between)
        if (key !== null && key !== existing.legacy_key && (await keyInUse(tx, userId, kind, key, id))) return { status: 'key_taken' };
        const version = await nextVersion(tx, userId);
        const updated = await tx.$queryRawUnsafe<Row[]>(
          `UPDATE record SET body = CASE WHEN $1 THEN body || $2::jsonb ELSE $2::jsonb END, legacy_key = $3, updated_at = $4, version = $5
            WHERE id = $6::uuid AND user_id = $7::uuid ${RETURNING}`,
          merge, json, key, now, version, id, userId,
        );
        return { status: 'saved', record: fromRow(updated[0]!) };
      }
      if (input.legacyKey && (await keyInUse(tx, userId, kind, input.legacyKey, id))) return { status: 'key_taken' };
      const version = await nextVersion(tx, userId);
      const inserted = await tx.$queryRawUnsafe<Row[]>(
        `INSERT INTO record (id, user_id, kind, legacy_key, position, body, created_at, updated_at, version)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $7, $5)
         ON CONFLICT DO NOTHING ${RETURNING}`,
        id, userId, kind, input.legacyKey ?? null, version, json, now,
      );
      if (inserted[0]) return { status: 'saved', record: fromRow(inserted[0]) };
      // nothing inserted: another person took this id a moment ago
      return { status: 'taken' };
    });
  }

  async remove(userId: string, kind: RecordKind, id: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockChangeCounter(tx, userId);
      const live = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM record WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND kind = ${kind} AND deleted_at IS NULL FOR UPDATE`;
      if (!live[0]) return;
      const version = await nextVersion(tx, userId);
      await tx.$queryRaw`UPDATE record SET deleted_at = ${now}, updated_at = ${now}, version = ${version} WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
    });
  }

  async find(userId: string, kind: RecordKind, id: string): Promise<StoredRecord | null> {
    // the owner is part of the query itself: another person's record is simply not found
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT id, user_id, kind, legacy_key, position, body, created_at, updated_at, deleted_at, version
        FROM record WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND kind = ${kind} AND deleted_at IS NULL`;
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async list(userId: string, kind: RecordKind): Promise<StoredRecord[]> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT id, user_id, kind, legacy_key, position, body, created_at, updated_at, deleted_at, version
        FROM record WHERE user_id = ${userId}::uuid AND kind = ${kind} AND deleted_at IS NULL ORDER BY position, id`;
    return rows.map(fromRow);
  }

  async changesSince(userId: string, kind: RecordKind, afterVersion: number, limit: number): Promise<StoredRecord[]> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT id, user_id, kind, legacy_key, position, body, created_at, updated_at, deleted_at, version
        FROM record WHERE user_id = ${userId}::uuid AND kind = ${kind} AND version > ${afterVersion} ORDER BY version LIMIT ${limit}`;
    return rows.map(fromRow);
  }

  async getState(userId: string): Promise<StoredState | null> {
    const row = await this.prisma.userState.findUnique({ where: { userId } });
    return row ? { body: row.body as Body, version: Number(row.version), updatedAt: row.updatedAt } : null;
  }

  async putState(userId: string, body: Body, now: Date): Promise<StoredState> {
    const json = JSON.stringify(body);
    return this.prisma.$transaction(async (tx) => {
      await lockChangeCounter(tx, userId);
      const current = await tx.$queryRaw<{ body: Body; version: bigint; updated_at: Date; same: boolean }[]>`
        SELECT body, version, updated_at, body = ${json}::jsonb AS same FROM user_state WHERE user_id = ${userId}::uuid FOR UPDATE`;
      const row = current[0];
      if (row?.same) return { body: row.body, version: Number(row.version), updatedAt: row.updated_at };
      const version = await nextVersion(tx, userId);
      await tx.$queryRaw`
        INSERT INTO user_state (user_id, body, version, updated_at) VALUES (${userId}::uuid, ${json}::jsonb, ${version}, ${now})
        ON CONFLICT (user_id) DO UPDATE SET body = EXCLUDED.body, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at`;
      return { body, version, updatedAt: now };
    });
  }

  async importAll(userId: string, items: readonly ImportItem[], state: Body, now: Date, replace: boolean): Promise<ImportResult> {
    return this.prisma.$transaction(
      async (tx): Promise<ImportResult> => {
        await lockChangeCounter(tx, userId);
        const existing = await tx.$queryRaw<{ n: bigint }[]>`
          SELECT (SELECT count(*) FROM record WHERE user_id = ${userId}::uuid AND deleted_at IS NULL) + (SELECT count(*) FROM user_state WHERE user_id = ${userId}::uuid) AS n`;
        if (Number(existing[0]!.n) > 0) {
          if (!replace) return { status: 'not_empty' };
          const live = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM record WHERE user_id = ${userId}::uuid AND deleted_at IS NULL ORDER BY position`;
          // one version for each tombstone, in one statement
          const first = await reserve(tx, userId, live.length);
          await tx.$queryRaw`
            UPDATE record r SET deleted_at = ${now}, updated_at = ${now}, version = ${first}::bigint + d.n - 1
              FROM (SELECT id, row_number() OVER (ORDER BY position) AS n FROM record WHERE user_id = ${userId}::uuid AND deleted_at IS NULL) d
             WHERE r.id = d.id`;
          await tx.$queryRaw`DELETE FROM user_state WHERE user_id = ${userId}::uuid`;
          // a removed legacy key must be free for the new data
          await tx.$queryRaw`UPDATE record SET legacy_key = NULL WHERE user_id = ${userId}::uuid AND deleted_at IS NOT NULL AND legacy_key IS NOT NULL`;
        }
        for (let from = 0; from < items.length; from += IMPORT_CHUNK) {
          const chunk = items.slice(from, from + IMPORT_CHUNK);
          const first = await reserve(tx, userId, chunk.length);
          const rows = chunk.map((item, i) => ({ id: item.id, kind: item.kind, legacy_key: item.legacyKey, body: item.body, version: first + i }));
          await tx.$queryRaw`
            INSERT INTO record (id, user_id, kind, legacy_key, position, body, created_at, updated_at, version)
            SELECT x.id, ${userId}::uuid, x.kind, x.legacy_key, x.version, x.body, ${now}, ${now}, x.version
              FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(id uuid, kind text, legacy_key text, body jsonb, version bigint)`;
        }
        const stateVersion = await nextVersion(tx, userId);
        await tx.$queryRaw`INSERT INTO user_state (user_id, body, version, updated_at) VALUES (${userId}::uuid, ${JSON.stringify(state)}::jsonb, ${stateVersion}, ${now})`;
        return { status: 'imported', records: items.length };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }
}

/** Takes `count` versions at once (after lockChangeCounter) and returns the first. */
async function reserve(tx: Pick<PrismaService, '$queryRaw'>, userId: string, count: number): Promise<number> {
  if (count === 0) return 0;
  const rows = await tx.$queryRaw<{ last_version: bigint }[]>`
    UPDATE sync_cursor SET last_version = last_version + ${count} WHERE user_id = ${userId}::uuid RETURNING last_version`;
  return Number(rows[0]!.last_version) - count + 1;
}

async function keyInUse(tx: Pick<PrismaService, '$queryRaw'>, userId: string, kind: string, key: string, exceptId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM record WHERE user_id = ${userId}::uuid AND kind = ${kind} AND legacy_key = ${key} AND id <> ${exceptId}::uuid`;
  return rows.length > 0;
}

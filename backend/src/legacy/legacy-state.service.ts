import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK, type Clock } from '../clock';
import { type LegacyState } from '../domain/domain-runtime';
import { RECORD_KINDS, RECORD_STORE, type RecordKind, type RecordStore, type StoredRecord } from '../records/record.store';
import { emptyRecords, joinLegacyState, parseLegacyState } from './legacy-state';

export interface ImportSummary {
  readonly records: number;
  readonly byKind: Readonly<Record<RecordKind, number>>;
}

/** Moves a person's whole data between the browser app's JSON (its backup/export) and the stored records. */
@Injectable()
export class LegacyStateService {
  constructor(
    @Inject(RECORD_STORE) private readonly store: RecordStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Without `replace`, a person who already has data is refused: an import must never silently overwrite. */
  async importState(userId: string, raw: unknown, replace: boolean): Promise<ImportSummary> {
    const parsed = parseLegacyState(raw);
    if (!parsed.ok) throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: 'Invalid state', issues: parsed.issues });
    const result = await this.store.importAll(userId, parsed.items, parsed.settings, this.clock.now(), replace);
    if (result.status === 'not_empty') throw new ConflictException({ statusCode: 409, error: 'Conflict', code: 'not_empty', message: 'This person already has data' });
    const byKind = Object.fromEntries(RECORD_KINDS.map((k) => [k, 0])) as Record<RecordKind, number>;
    for (const item of parsed.items) byKind[item.kind]++;
    return { records: result.records, byKind };
  }

  /** The state as the rules read it, or null when the person has nothing stored yet. */
  async loadState(userId: string): Promise<LegacyState | null> {
    const settings = await this.store.getState(userId);
    const records = emptyRecords();
    const lists: StoredRecord[][] = await Promise.all(RECORD_KINDS.map((kind) => this.store.list(userId, kind)));
    RECORD_KINDS.forEach((kind, i) => (records[kind] = lists[i]!));
    if (!settings && RECORD_KINDS.every((k) => records[k].length === 0)) return null;
    return joinLegacyState(records, settings?.body ?? null);
  }

  async exportState(userId: string): Promise<LegacyState> {
    const state = await this.loadState(userId);
    if (!state) throw new NotFoundException();
    return state;
  }
}

export interface AuditEntry {
  readonly actorUserId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export interface AuditRepository {
  record(entry: AuditEntry, now: Date): Promise<void>;
}

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

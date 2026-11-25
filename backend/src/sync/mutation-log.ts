import { type ApplyOutcome } from './sync-resource';

/** What a device was told about a mutation. Stored, so the same mutation sent again gets the same answer. */
export type MutationOutcome = ApplyOutcome;

export interface MutationLog {
  find(userId: string, mutationId: string): Promise<MutationOutcome | null>;
  /** Keeps the first answer: recording the same mutation again does not change it. */
  record(userId: string, mutationId: string, outcome: MutationOutcome, now: Date): Promise<void>;
}

export const MUTATION_LOG = Symbol('MUTATION_LOG');

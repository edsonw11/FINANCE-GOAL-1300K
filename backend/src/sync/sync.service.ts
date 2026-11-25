import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../clock';
import { MUTATION_LOG, type MutationLog } from './mutation-log';
import { type PushMutation } from './sync.schemas';
import { type ApplyOutcome, SYNC_RESOURCES, type SyncChange, type SyncResource } from './sync-resource';

export type PushResult = ({ readonly mutationId: string } & ApplyOutcome) | { readonly mutationId: string; readonly status: 'skipped' };

export interface ChangesPage {
  readonly changes: SyncChange[];
  /** Give this back as `cursor` next time. */
  readonly cursor: string;
  readonly hasMore: boolean;
}

@Injectable()
export class SyncService {
  private readonly resources: Map<string, SyncResource>;

  constructor(
    @Inject(SYNC_RESOURCES) resources: SyncResource[],
    @Inject(MUTATION_LOG) private readonly log: MutationLog,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.resources = new Map(resources.map((r) => [r.name, r]));
  }

  /**
   * Applies the device's outbox in the order it was made. A mutation the device must look at (rejected) stops the batch:
   * later ones may depend on it, so they come back as "skipped" and the device sends them again after dealing with it.
   * A mutation already seen gets its first answer again and changes nothing.
   */
  async push(userId: string, mutations: readonly PushMutation[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    let stopped = false;
    for (const mutation of mutations) {
      if (stopped) {
        results.push({ mutationId: mutation.mutationId, status: 'skipped' });
        continue;
      }
      const seen = await this.log.find(userId, mutation.mutationId);
      const outcome = seen ?? (await this.applyAndRemember(userId, mutation));
      results.push({ mutationId: mutation.mutationId, ...outcome });
      if (outcome.status === 'rejected') stopped = true;
    }
    return results;
  }

  private async applyAndRemember(userId: string, mutation: PushMutation): Promise<ApplyOutcome> {
    const now = this.clock.now();
    const resource = this.resources.get(mutation.resource);
    const outcome: ApplyOutcome = !resource
      ? { status: 'rejected', reason: 'unknown_resource' }
      : mutation.op === 'put'
        ? await resource.put(userId, mutation.id, mutation.data, now)
        : await resource.remove(userId, mutation.id, now);
    await this.log.record(userId, mutation.mutationId, outcome, now);
    return outcome;
  }

  /** What changed for this person after the cursor, across every resource, in version order. */
  async changes(userId: string, afterVersion: number, limit: number): Promise<ChangesPage> {
    const perResource = await Promise.all([...this.resources.values()].map((r) => r.changesSince(userId, afterVersion, limit + 1)));
    const merged = perResource.flat().sort((a, b) => a.version - b.version);
    const page = merged.slice(0, limit);
    const last = page[page.length - 1];
    return { changes: page, cursor: String(last ? last.version : afterVersion), hasMore: merged.length > limit };
  }
}

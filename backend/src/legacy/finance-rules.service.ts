import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { type DomainApi, loadDomain, runWithState } from '../domain/domain-runtime';
import { LegacyStateService } from './legacy-state.service';

/** Runs the shared rules (the same files as the browser app) on one person's data. */
@Injectable()
export class FinanceRulesService implements OnModuleInit {
  constructor(@Inject(LegacyStateService) private readonly state: LegacyStateService) {}

  /** Loaded at start, not at the first request: the first person does not wait for a hundred modules, and a missing rules folder stops the start instead of failing later. */
  async onModuleInit(): Promise<void> {
    await loadDomain();
  }

  /**
   * `fn` is synchronous (ADR-0006) and gets the rules by name. A person with nothing stored yet, or a sparse state, is completed from the blank state the app starts from.
   * Nothing is saved: these are reads.
   */
  async compute<T>(userId: string, fn: (api: DomainApi) => T): Promise<T> {
    const stored = await this.state.loadState(userId);
    // the rules expect what the app always has (goal, rate, the three lists): whatever the stored state lacks comes from the blank state
    const blank = ((await loadDomain()).api.blankState as () => Record<string, unknown>)();
    const state = { ...blank, ...stored };
    const { result } = await runWithState(state, fn);
    return result;
  }
}

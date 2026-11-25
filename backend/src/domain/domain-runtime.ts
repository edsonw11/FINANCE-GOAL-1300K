import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The state the browser app keeps, as the shared rules read it (ADR-0006). */
export type LegacyState = Record<string, unknown>;

/** Every function the shared rules export, by name (the names are unique across modules by construction). */
export type DomainApi = Record<string, (...args: never[]) => unknown> & Record<string, unknown>;

/**
 * Where the shared rules live: `src/` of the repository (the same files the browser app uses, ADR-0001). A container image
 * copies them next to the API and sets DOMAIN_ROOT.
 */
export function domainRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.DOMAIN_ROOT ? resolve(env.DOMAIN_ROOT) : resolve(__dirname, '../../../src');
}

interface Loaded {
  readonly api: DomainApi;
  readonly withState: <T>(state: LegacyState, fn: () => T) => { result: T; state: LegacyState };
}

/** Plain JavaScript modules of the browser app, loaded once; they have no DOM at import time (lint enforces it). */
let loading: Promise<Loaded> | null = null;

export function loadDomain(root = domainRoot()): Promise<Loaded> {
  loading ??= (async () => {
    const api: Record<string, unknown> = {};
    for (const folder of ['core', 'domain']) {
      const dir = join(root, folder);
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
        const mod = (await import(pathToFileURL(join(dir, file)).href)) as Record<string, unknown>;
        for (const [name, value] of Object.entries(mod)) if (typeof value === 'function' && !Object.hasOwn(api, name)) api[name] = value;
      }
    }
    const store = (await import(pathToFileURL(join(root, 'domain', 'store.js')).href)) as { withState: Loaded['withState'] };
    return { api: api as DomainApi, withState: store.withState };
  })();
  return loading;
}

/**
 * Runs rules against ONE person's state. Synchronous on purpose (ADR-0006): nothing else can run while this state is in force.
 * `fn` gets the rules by name and returns what it computed; the state is returned too, because a command may change it.
 */
export async function runWithState<T>(state: LegacyState, fn: (api: DomainApi) => T, root?: string): Promise<{ result: T; state: LegacyState }> {
  const domain = await loadDomain(root);
  return domain.withState(state, () => fn(domain.api));
}

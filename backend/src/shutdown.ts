/** Something that can be closed and takes a while doing it (the Nest application: stops the server, closes the pool). */
export interface Closable {
  close(): Promise<unknown>;
}

/** The part of `process` the shutdown needs, so a test can pass a fake. */
export interface ProcessLike {
  on(signal: NodeJS.Signals, handler: () => void): unknown;
  exit(code: number): unknown;
}

export interface ShutdownOptions {
  readonly signals?: readonly NodeJS.Signals[];
  /** After this long without finishing, give up and exit with an error. */
  readonly timeoutMs?: number;
  readonly processRef?: ProcessLike;
  readonly log?: (message: string) => void;
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Closes the application when the operating system asks (SIGTERM from docker/ECS, SIGINT from Ctrl+C) and exits with:
 *  - 0 when everything closed,
 *  - 1 when closing failed, took longer than the limit, or the signal came a second time (impatient operator).
 * It does not use Nest's enableShutdownHooks, which ends the process by re-sending the signal (no exit code, no time limit).
 */
export function registerGracefulShutdown(app: Closable, options: ShutdownOptions = {}): void {
  const {
    signals = ['SIGTERM', 'SIGINT'],
    timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    processRef = process,
    log = () => undefined,
  } = options;
  let closing = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (closing) {
      log(`Received ${signal} again while shutting down: leaving now`);
      processRef.exit(1);
      return;
    }
    closing = true;
    log(`Received ${signal}: shutting down`);
    const limit = setTimeout(() => {
      log(`Shutdown did not finish in ${timeoutMs} ms: leaving now`);
      processRef.exit(1);
    }, timeoutMs);
    limit.unref(); // the timer alone must not keep the process alive
    app.close().then(
      () => {
        clearTimeout(limit);
        log('Shutdown complete');
        processRef.exit(0);
      },
      (error: unknown) => {
        clearTimeout(limit);
        log(`Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
        processRef.exit(1);
      },
    );
  };

  for (const signal of signals) {
    // `on`, not `once`: the second signal must reach us to force the exit
    processRef.on(signal, () => shutdown(signal));
  }
}

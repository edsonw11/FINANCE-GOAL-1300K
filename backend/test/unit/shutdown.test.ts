import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHUTDOWN_TIMEOUT_MS, type ProcessLike, registerGracefulShutdown } from '../../src/shutdown';

/** A fake `process`: signals are fired by the test, exit only records the code. */
function fakeProcess() {
  const handlers = new Map<string, () => void>();
  const exit = vi.fn();
  const ref: ProcessLike = { on: (signal, handler) => void handlers.set(signal, handler), exit };
  return { ref, exit, send: (signal: string) => handlers.get(signal)?.(), signals: () => [...handlers.keys()] };
}

/** An app whose close() the test finishes by hand. */
function slowApp() {
  let finish!: () => void;
  let fail!: (e: unknown) => void;
  const close = vi.fn(() => new Promise<void>((ok, bad) => ((finish = ok), (fail = bad))));
  return { close, finish: () => finish(), fail: (e: unknown) => fail(e) };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('registerGracefulShutdown', () => {
  it('listens to SIGTERM (docker, ECS) and SIGINT (Ctrl+C) by default', () => {
    const p = fakeProcess();
    registerGracefulShutdown(slowApp(), { processRef: p.ref });
    expect(p.signals().sort()).toEqual(['SIGINT', 'SIGTERM']);
  });

  it('listens only to the signals it is given', () => {
    const p = fakeProcess();
    registerGracefulShutdown(slowApp(), { processRef: p.ref, signals: ['SIGHUP'] });
    expect(p.signals()).toEqual(['SIGHUP']);
  });

  it('does nothing until a signal arrives', () => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref });
    expect(app.close).not.toHaveBeenCalled();
    expect(p.exit).not.toHaveBeenCalled();
  });

  it('closes the application and only then exits with 0', async () => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref });
    p.send('SIGTERM');
    await settle();
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(p.exit).not.toHaveBeenCalled(); // still closing
    app.finish();
    await settle();
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it.each(['SIGTERM', 'SIGINT'])('works for %s', async (signal) => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref });
    p.send(signal);
    app.finish();
    await settle();
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('exits with 1 when closing fails, and says why', async () => {
    const p = fakeProcess();
    const app = slowApp();
    const log = vi.fn();
    registerGracefulShutdown(app, { processRef: p.ref, log });
    p.send('SIGTERM');
    app.fail(new Error('pool stuck'));
    await settle();
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(log).toHaveBeenCalledWith('Shutdown failed: pool stuck');
  });

  it('copes with a failure that is not an Error', async () => {
    const p = fakeProcess();
    const app = slowApp();
    const log = vi.fn();
    registerGracefulShutdown(app, { processRef: p.ref, log });
    p.send('SIGTERM');
    app.fail('plain text');
    await settle();
    expect(log).toHaveBeenCalledWith('Shutdown failed: plain text');
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('gives up with 1 when closing takes longer than the limit', async () => {
    const p = fakeProcess();
    registerGracefulShutdown(slowApp(), { processRef: p.ref, timeoutMs: 5000 });
    p.send('SIGTERM');
    await vi.advanceTimersByTimeAsync(4999);
    expect(p.exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('has a limit of 10 seconds by default', async () => {
    expect(DEFAULT_SHUTDOWN_TIMEOUT_MS).toBe(10_000);
    const p = fakeProcess();
    registerGracefulShutdown(slowApp(), { processRef: p.ref });
    p.send('SIGTERM');
    await vi.advanceTimersByTimeAsync(DEFAULT_SHUTDOWN_TIMEOUT_MS - 1);
    expect(p.exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(p.exit).toHaveBeenCalledWith(1);
  });

  it('does not exit by the limit when the application closed in time', async () => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref, timeoutMs: 5000 });
    p.send('SIGTERM');
    app.finish();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the limit timer after a failure too', async () => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref, timeoutMs: 5000 });
    p.send('SIGTERM');
    app.fail(new Error('x'));
    await settle();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a second signal while closing leaves at once with 1, and does not close twice', async () => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref });
    p.send('SIGINT');
    await settle();
    p.send('SIGINT');
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('a different signal while closing counts as the second one', async () => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref });
    p.send('SIGTERM');
    p.send('SIGINT');
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('logs what it is doing', async () => {
    const p = fakeProcess();
    const app = slowApp();
    const log = vi.fn();
    registerGracefulShutdown(app, { processRef: p.ref, log });
    p.send('SIGTERM');
    app.finish();
    await settle();
    expect(log.mock.calls.map((c) => c[0])).toEqual(['Received SIGTERM: shutting down', 'Shutdown complete']);
  });

  it('names the signal it received', async () => {
    const p = fakeProcess();
    const log = vi.fn();
    registerGracefulShutdown(slowApp(), { processRef: p.ref, log });
    p.send('SIGINT');
    expect(log).toHaveBeenCalledWith('Received SIGINT: shutting down');
  });

  it('does not let its time limit keep the process alive', () => {
    const p = fakeProcess();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    registerGracefulShutdown(slowApp(), { processRef: p.ref });
    p.send('SIGTERM');
    const timer = setTimeoutSpy.mock.results[0]?.value as { hasRef(): boolean };
    expect(timer.hasRef()).toBe(false);
  });

  it('works without a logger', async () => {
    const p = fakeProcess();
    const app = slowApp();
    registerGracefulShutdown(app, { processRef: p.ref });
    p.send('SIGTERM');
    app.finish();
    await settle();
    expect(p.exit).toHaveBeenCalledExactlyOnceWith(0);
  });
});

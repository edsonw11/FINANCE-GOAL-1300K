import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { OIDC_DEV, OIDC_PROD } from '../support/env';
import { databaseUrl } from './support';

// The built program (dist/main.js) as a separate process, the way a container runs it.
const MAIN = resolve(__dirname, '../../dist/main.js');
const children: ChildProcess[] = [];

beforeAll(() => {
  if (!existsSync(MAIN)) throw new Error('dist/main.js is missing: run `npm run build` first.');
});
afterEach(() => {
  for (const c of children.splice(0)) c.kill('SIGKILL');
});

/** A free port, so the test never collides with something already running. */
const freePort = () =>
  new Promise<number>((ok, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });

const cleanEnv = (extra: Record<string, string>) => ({ PATH: process.env.PATH ?? '', ...extra });

describe('dist/main.js: invalid configuration', () => {
  it('stops with exit code 1 and lists every problem, without printing a secret', () => {
    const run = spawnSync('node', [MAIN], {
      encoding: 'utf8',
      env: cleanEnv({ PORT: 'secret-port', DATABASE_URL: 'mysql://admin:HushHush99@h/db' }),
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Invalid configuration');
    expect(run.stderr).toContain('PORT');
    expect(run.stderr).toContain('DATABASE_URL');
    for (const secret of ['HushHush99', 'secret-port', 'admin']) expect(run.stderr + run.stdout).not.toContain(secret);
  });

  it('stops when there is no configuration at all', () => {
    const run = spawnSync('node', [MAIN], { encoding: 'utf8', env: cleanEnv({}) });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('DATABASE_URL is required');
    expect(run.stderr).toContain('APP_BASE_URL');
    expect(run.stderr).toContain('OIDC_ISSUER');
  });

  it('stops in production with the development password', () => {
    const run = spawnSync('node', [MAIN], {
      encoding: 'utf8',
      env: cleanEnv({ ...OIDC_PROD, NODE_ENV: 'production', DATABASE_URL: 'postgresql://everfox:everfox_dev_only@127.0.0.1:5433/everfox' }),
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('development password');
    expect(run.stderr).not.toContain('everfox_dev_only');
  });
});

describe('dist/main.js: running', () => {
  async function startServer() {
    const port = await freePort();
    const child = spawn('node', [MAIN], {
      env: cleanEnv({ ...OIDC_DEV, DATABASE_URL: databaseUrl(), PORT: String(port), HOST: '127.0.0.1', LOG_LEVEL: 'info' }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    let output = '';
    child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (output += d.toString()));
    const deadline = Date.now() + 15_000;
    while (!/Listening on/.test(output)) {
      if (child.exitCode !== null) throw new Error(`the process exited early (${child.exitCode}):\n${output}`);
      if (Date.now() > deadline) throw new Error(`the process did not start:\n${output}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    return { child, port, output: () => output };
  }

  it('starts, answers, and logs the database address without its password', async () => {
    const { port, output } = await startServer();
    expect((await fetch(`http://127.0.0.1:${port}/health/live`)).status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${port}/health/ready`)).status).toBe(200);
    const password = new URL(databaseUrl()).password;
    expect(output()).toContain('database postgresql://');
    expect(output()).not.toContain(password);
  });

  it('shuts down cleanly (exit code 0) on SIGTERM, as a container orchestrator asks', async () => {
    const { child, port } = await startServer();
    await fetch(`http://127.0.0.1:${port}/health/ready`);
    const exited = new Promise<number | null>((ok) => child.once('exit', (code) => ok(code)));
    child.kill('SIGTERM');
    expect(await Promise.race([exited, new Promise((ok) => setTimeout(() => ok('timeout'), 10_000))])).toBe(0);
  });

  it('refuses a second process on the same port instead of hiding the problem', async () => {
    const { port } = await startServer();
    const second = spawnSync('node', [MAIN], {
      encoding: 'utf8',
      timeout: 15_000,
      env: cleanEnv({ ...OIDC_DEV, DATABASE_URL: databaseUrl(), PORT: String(port), HOST: '127.0.0.1', LOG_LEVEL: 'error' }),
    });
    expect(second.status).not.toBe(0);
    expect(second.stderr).toMatch(/EADDRINUSE|address already in use/i);
  });
});

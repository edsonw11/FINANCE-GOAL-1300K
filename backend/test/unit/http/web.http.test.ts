import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanWebAssets, webRoot } from '../../../src/web/web-assets';
import { type TestApp, createTestApp } from '../../support/http-app';

let root: string;
let t: TestApp;
const previous = process.env.WEB_ROOT;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'everfox-web-'));
  mkdirSync(join(root, 'src', 'ui'), { recursive: true });
  mkdirSync(join(root, 'vendor'));
  mkdirSync(join(root, 'backend'));
  writeFileSync(join(root, 'index.html'), '<html>app</html>');
  writeFileSync(join(root, 'src', 'app.js'), 'export const a = 1;');
  writeFileSync(join(root, 'src', 'ui', 'view.js'), 'export const b = 2;');
  writeFileSync(join(root, 'src', 'style.css'), 'body{}');
  writeFileSync(join(root, 'src', 'notes.txt'), 'not a web file');
  writeFileSync(join(root, 'src', '.hidden.js'), 'TOPSECRET');
  writeFileSync(join(root, 'vendor', 'lib.mjs'), 'export {}');
  writeFileSync(join(root, '.env'), 'DATABASE_URL=TOPSECRET');
  writeFileSync(join(root, 'package.json'), '{"x":"TOPSECRET"}');
  writeFileSync(join(root, 'backend', 'secret.js'), 'TOPSECRET');
  writeFileSync(join(tmpdir(), 'everfox-outside.js'), 'outside');
  symlinkSync(join(tmpdir(), 'everfox-outside.js'), join(root, 'src', 'link.js'));
  process.env.WEB_ROOT = root;
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
  if (previous === undefined) delete process.env.WEB_ROOT;
  else process.env.WEB_ROOT = previous;
  rmSync(root, { recursive: true, force: true });
  rmSync(join(tmpdir(), 'everfox-outside.js'), { force: true });
});
const get = (url: string) => t.app.inject({ method: 'GET', url });

describe('the browser app served by the API', () => {
  it('serves the page at / and at /index.html, without logging in', async () => {
    for (const url of ['/', '/index.html']) {
      const res = await get(url);
      expect([res.statusCode, res.body, res.headers['content-type']]).toEqual([200, '<html>app</html>', 'text/html; charset=utf-8']);
    }
  });

  it('serves scripts with a JavaScript type (browsers refuse modules otherwise) and styles as CSS', async () => {
    expect((await get('/src/app.js')).headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect((await get('/src/ui/view.js')).body).toBe('export const b = 2;');
    expect((await get('/vendor/lib.mjs')).headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect((await get('/src/style.css')).headers['content-type']).toBe('text/css; charset=utf-8');
  });

  it('adds nosniff and a same-origin referrer policy, and never lets a shared cache keep it', async () => {
    const res = await get('/src/app.js');
    expect([res.headers['x-content-type-options'], res.headers['referrer-policy'], res.headers['cache-control']]).toEqual(['nosniff', 'same-origin', 'no-store']);
  });

  it('ignores a query string', async () => {
    expect((await get('/src/app.js?v=3')).statusCode).toBe(200);
  });

  it.each([
    '/.env',
    '/package.json',
    '/backend/secret.js',
    '/src/notes.txt',
    '/src/.hidden.js',
    '/src/link.js',
    '/src/',
    '/src',
    '/src/ui',
    '/src/../.env',
    '/src/../package.json',
    '/src/%2e%2e/.env',
    '/src/%2E%2E/package.json',
    '/src/..%2f.env',
    '/src/ui/..%2f..%2f.env',
    '/src//app.js',
    '/src/app.js%00.txt',
    '/src/app.js/',
    '/src/APP.JS',
    '/vendor/../.env',
    '/vendor/nothing.js',
  ])('does not serve %s', async (url) => {
    const res = await get(url);
    expect(res.statusCode, `${url} -> ${res.statusCode}`).toBeGreaterThanOrEqual(400);
    expect(res.body).not.toContain('TOPSECRET');
    expect(res.body).not.toContain('outside');
  });

  it('a backslash path never reaches a file (the router turns it into the public page)', async () => {
    const res = await get('/\\.env');
    expect(res.body).not.toContain('TOPSECRET');
    expect(res.body).not.toContain('DATABASE_URL');
  });

  it('only serves what a read asks for (no writing)', async () => {
    expect((await t.app.inject({ method: 'POST', url: '/src/app.js' })).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('keeps the API closed: the app being public does not open the data', async () => {
    expect((await get('/api/v1/me')).statusCode).toBe(401);
  });
});

describe('scanWebAssets', () => {
  it('lists only web files of the two public folders and the page', () => {
    expect([...scanWebAssets(root).keys()].sort()).toEqual(['/', '/index.html', '/src/app.js', '/src/style.css', '/src/ui/view.js', '/vendor/lib.mjs'].sort());
  });

  it('is empty, not an error, for a folder that does not exist', () => {
    expect(scanWebAssets(join(root, 'nope')).size).toBe(0);
  });

  it('reads WEB_ROOT, and falls back to the repository root', () => {
    expect(webRoot({ WEB_ROOT: '/srv/web' } as NodeJS.ProcessEnv)).toBe('/srv/web');
    expect(webRoot({} as NodeJS.ProcessEnv)).toMatch(/FINANCE-GOAL-1300K$/);
  });
});

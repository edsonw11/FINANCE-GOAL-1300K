import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pageCsp } from '../security/security-headers';

export const WEB_ASSETS = Symbol('WEB_ASSETS');

export interface WebAsset {
  readonly file: string;
  readonly type: string;
  /** The page's content-security-policy (only for the page). */
  readonly csp?: string;
}

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};
/** Folders of the web app that are public (the browser app itself); nothing else under the root is ever served. */
const FOLDERS = ['src', 'vendor'] as const;

/** Where the browser app lives: the repository root by default (next to `backend/`), WEB_ROOT in an image. */
export function webRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.WEB_ROOT ? resolve(env.WEB_ROOT) : resolve(__dirname, '../../..');
}

function walk(dir: string, urlPrefix: string, out: Map<string, WebAsset>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) walk(join(dir, entry.name), `${urlPrefix}/${entry.name}`, out);
    else if (entry.isFile()) {
      const type = TYPES[extname(entry.name).toLowerCase()];
      if (type) out.set(`${urlPrefix}/${entry.name}`, { file: join(dir, entry.name), type });
    }
  }
}

/**
 * The exact list of files that may be served, found once at startup. A request is answered only if its path is a key of this map,
 * so a path like `/src/../.env` or an encoded variant is simply not in the list: there is no path to sanitise.
 */
export function scanWebAssets(root: string): Map<string, WebAsset> {
  const assets = new Map<string, WebAsset>();
  try {
    readdirSync(root);
  } catch {
    return assets;
  }
  if (readdirSync(root).includes('index.html')) {
    const file = join(root, 'index.html');
    const index: WebAsset = { file, type: TYPES['.html']!, csp: pageCsp(readFileSync(file, 'utf8')) };
    assets.set('/', index);
    assets.set('/index.html', index);
  }
  for (const folder of FOLDERS) {
    try {
      walk(join(root, folder), `/${folder}`, assets);
    } catch {
      // a folder that is not there is not served
    }
  }
  return assets;
}

import { createHash } from 'node:crypto';

/** Sent on every answer. The API only ever answers data, so nothing in it may be framed, sniffed, cached or given to another origin. */
export function baseHeaders(secure: boolean): Record<string, string> {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    // data answers are never pages: if one is opened as a page it may load and run nothing
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    // only over HTTPS (production): on plain http it would lock a developer out of localhost
    ...(secure ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

/** The hash a CSP uses to allow one specific inline script (and nothing else inline). */
export const scriptHash = (code: string): string => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;

/** The inline scripts of a page (not the ones with a src), exactly as the browser hashes them. */
export function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!).filter((code) => code.trim() !== '');
}

/**
 * The policy of the app's page: own files only, no plugins, no other site can frame it or take its forms, and the only inline script allowed is
 * the ones the page itself ships (by hash). Styles keep 'unsafe-inline' because the screens set style attributes: a known, accepted weakness (it cannot run code).
 */
export function pageCsp(html: string): string {
  const hashes = inlineScripts(html).map(scriptHash);
  return [
    "default-src 'self'",
    `script-src 'self'${hashes.length ? ' ' + hashes.join(' ') : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

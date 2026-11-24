const HIDDEN = '[invalid url]';

/**
 * Hides the password of a connection URL so it can be logged: postgresql://user:***@host:5432/db
 * Safe by default: anything that is not a URL with a host (so it could be text with a secret in it, like "user:pw")
 * is answered with a fixed text, never echoed.
 */
export function redactUrl(url: string): string {
  if (!URL.canParse(url)) return HIDDEN;
  const parsed = new URL(url);
  if (!parsed.host) return HIDDEN;
  if (parsed.password) parsed.password = '***';
  return parsed.toString();
}

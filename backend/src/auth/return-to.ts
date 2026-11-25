const MAX_LENGTH = 512;
const PROBE_ORIGIN = 'http://return.invalid';

/**
 * Where to send the user after login. Only a path of this same site is allowed, otherwise the login page becomes an
 * open redirect (a link that logs you in and then lands you on a look-alike site). Anything doubtful becomes "/".
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  // a backslash is a slash for browsers; tab, CR and LF are removed by them, so "/\t/evil.com" would become "//evil.com"
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  let probe: URL;
  try {
    probe = new URL(value, PROBE_ORIGIN);
  } catch {
    return '/';
  }
  if (probe.origin !== PROBE_ORIGIN) return '/';
  // "/..//evil.com" is normalised to "//evil.com", which a browser reads as another site
  if (probe.pathname.startsWith('//')) return '/';
  return probe.pathname + probe.search + probe.hash;
}

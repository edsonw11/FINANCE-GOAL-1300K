import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '../../../src/auth/return-to';

describe('safeReturnTo: paths of this site are kept', () => {
  it.each(['/', '/dashboard', '/a/b/c', '/accounts?x=1&y=2', '/page#section', '/a?b=c#d', '/with%20space', '/ação', '/a//b', '/a/./b'])('keeps %s', (value) => {
    expect(safeReturnTo(value)).toBe(new URL(value, 'http://x.invalid').pathname + new URL(value, 'http://x.invalid').search + new URL(value, 'http://x.invalid').hash);
  });

  it('keeps an ordinary path exactly', () => {
    expect(safeReturnTo('/accounts?tab=cards#top')).toBe('/accounts?tab=cards#top');
  });

  it('normalises dot segments inside the site', () => {
    expect(safeReturnTo('/a/../b')).toBe('/b');
  });
});

describe('safeReturnTo: anything that could leave the site becomes /', () => {
  it.each([
    ['another site', 'https://evil.example/'],
    ['http', 'http://evil.example'],
    ['protocol relative', '//evil.example'],
    ['protocol relative with path', '//evil.example/x'],
    ['triple slash', '///evil.example'],
    ['backslash', '/\\evil.example'],
    ['double backslash', '\\\\evil.example'],
    ['slash backslash slash', '/\\/evil.example'],
    ['tab inside (browsers remove it)', '/\t/evil.example'],
    ['newline inside', '/\n/evil.example'],
    ['carriage return inside', '/\r/evil.example'],
    ['null byte', '/a\0b'],
    ['control character', '/a\u001fb'],
    ['delete character', '/a\u007fb'],
    ['javascript url', 'javascript:alert(1)'],
    ['data url', 'data:text/html,x'],
    ['no leading slash', 'evil.example'],
    ['relative', 'dashboard'],
    ['dot dot relative', '../evil'],
    ['dots that normalise to protocol relative', '/..//evil.example'],
    ['more dots that normalise to protocol relative', '/a/..//evil.example'],
    ['empty', ''],
    ['a space', ' '],
    ['leading space', ' /ok'],
    ['userinfo', '/@evil.example'],
  ])('%s', (_label, value) => {
    const result = safeReturnTo(value);
    if (value === '/@evil.example') {
      // a path, not a host: it stays on this site
      expect(result).toBe('/@evil.example');
      return;
    }
    expect(result).toBe('/');
  });

  it.each([undefined, null, 5, true, {}, [], ['/ok'], ['/a', '/b']])('is / for a value that is not a string: %j', (value) => {
    expect(safeReturnTo(value)).toBe('/');
  });

  it('is / for a very long value', () => {
    expect(safeReturnTo('/' + 'a'.repeat(600))).toBe('/');
  });

  it('keeps a value at the length limit', () => {
    const value = '/' + 'a'.repeat(511);
    expect(safeReturnTo(value)).toBe(value);
    expect(safeReturnTo(value + 'a')).toBe('/');
  });

  it('never returns something a browser would read as another site', () => {
    const attempts = ['//a', '/\\a', '/\t/a', '/..//a', 'https://a', '/%2F/a', '/%5Ca', '/a/../../..//a', '/./\\a', '/.//a'];
    for (const attempt of attempts) {
      const result = safeReturnTo(attempt);
      expect(result.startsWith('//'), attempt).toBe(false);
      expect(result.startsWith('/\\'), attempt).toBe(false);
      expect(new URL(result, 'http://site.example').origin, attempt).toBe('http://site.example');
    }
  });
});

import { describe, expect, it } from 'vitest';
import { redactUrl } from '../../../src/config/redact';

describe('redactUrl', () => {
  it('hides the password and keeps everything else', () => {
    expect(redactUrl('postgresql://app:s3cret@db.internal:5432/everfox')).toBe('postgresql://app:***@db.internal:5432/everfox');
  });

  it('keeps the query string (sslmode, schema, ...)', () => {
    expect(redactUrl('postgresql://app:pw@h/db?sslmode=require&schema=public')).toBe('postgresql://app:***@h/db?sslmode=require&schema=public');
  });

  it('leaves a URL without password as it is', () => {
    expect(redactUrl('postgresql://app@h:5432/db')).toBe('postgresql://app@h:5432/db');
    expect(redactUrl('postgresql://h/db')).toBe('postgresql://h/db');
  });

  it.each(['p@ss:word', 'a/b?c#d', '%25', 'çãõ', 'with space'])('never leaves the password %j in the output', (password) => {
    const url = `postgresql://app:${encodeURIComponent(password)}@h/db`;
    const out = redactUrl(url);
    expect(out).not.toContain(encodeURIComponent(password));
    expect(out).not.toContain(password);
    expect(out).toContain(':***@');
  });

  it('answers a fixed text for something that is not a URL, never the input', () => {
    expect(redactUrl('not a url')).toBe('[invalid url]');
    expect(redactUrl('')).toBe('[invalid url]');
  });

  it.each(['pass:word', 'user:pw@host', 'postgresql://u:pw@/db?host=/var/run/postgresql', 'mailto:someone@example.com'])(
    'does not echo %j: it is not a connection URL with a host, so it may be a secret',
    (text) => {
      expect(redactUrl(text)).toBe('[invalid url]');
    },
  );

  it('does not change the original string', () => {
    const url = 'postgresql://app:pw@h/db';
    redactUrl(url);
    expect(url).toBe('postgresql://app:pw@h/db');
  });
});

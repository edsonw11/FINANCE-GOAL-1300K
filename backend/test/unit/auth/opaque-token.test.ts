import { describe, expect, it } from 'vitest';
import { hashToken, looksLikeToken, newOpaqueToken } from '../../../src/auth/opaque-token';

describe('newOpaqueToken', () => {
  it('is 43 characters of base64url (256 bits)', () => {
    for (let i = 0; i < 50; i++) expect(newOpaqueToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newOpaqueToken()));
    expect(seen.size).toBe(5000);
  });

  it('uses all the bits: the characters are spread, not a fixed pattern', () => {
    const chars = new Set(Array.from({ length: 200 }, () => newOpaqueToken()).join(''));
    expect(chars.size).toBeGreaterThan(55);
  });
});

describe('hashToken', () => {
  it('is a 64 character hex SHA-256', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is the same for the same token and different for another', () => {
    const a = newOpaqueToken();
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(newOpaqueToken()));
  });

  it('does not contain the token', () => {
    const token = newOpaqueToken();
    expect(hashToken(token)).not.toContain(token);
  });
});

describe('looksLikeToken', () => {
  it('accepts what newOpaqueToken makes', () => {
    for (let i = 0; i < 50; i++) expect(looksLikeToken(newOpaqueToken())).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', {}],
    ['an array holding a token', [newOpaqueToken()]],
    ['empty', ''],
    ['42 characters', 'a'.repeat(42)],
    ['44 characters', 'a'.repeat(44)],
    ['a huge string', 'a'.repeat(100_000)],
    ['with a plus', 'a'.repeat(42) + '+'],
    ['with a slash', 'a'.repeat(42) + '/'],
    ['with padding', 'a'.repeat(42) + '='],
    ['with a space', 'a'.repeat(42) + ' '],
    ['with a newline', 'a'.repeat(42) + '\n'],
    ['with a null byte', 'a'.repeat(42) + '\0'],
    ['with a quote', 'a'.repeat(42) + "'"],
    ['non-ascii', 'a'.repeat(42) + 'ç'],
  ])('rejects %s', (_label, value) => {
    expect(looksLikeToken(value)).toBe(false);
  });
});

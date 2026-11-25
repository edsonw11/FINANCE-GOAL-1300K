import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { chatsOf, loadSettings, parseEnv } from '../lib/env.mjs';

describe('parseEnv', () => {
  it('reads pairs, skips comments and blank lines', () => {
    assert.deepEqual(parseEnv('# a comment\n\nA=1\n  B = two \n'), { A: '1', B: 'two' });
  });
  it('keeps = inside a value and strips one pair of quotes', () => {
    assert.deepEqual(parseEnv('U=a=b=c\nQ="x y"\nS=\'z\'\nHALF="abc'), { U: 'a=b=c', Q: 'x y', S: 'z', HALF: '"abc' });
  });
  it('ignores lines without a valid name', () => {
    assert.deepEqual(parseEnv('=novalue\n1BAD=x\nno equals\nbad-name=x\nGOOD=ok'), { GOOD: 'ok' });
  });
  it('handles Windows line endings and empty values', () => {
    assert.deepEqual(parseEnv('A=1\r\nB=\r\n'), { A: '1', B: '' });
  });
});

describe('loadSettings', () => {
  const file = (text) => { const p = path.join(mkdtempSync(path.join(tmpdir(), 'env-')), '.env'); writeFileSync(p, text); return p; };
  it('a missing file is not an error', () => {
    assert.deepEqual(loadSettings('/nonexistent/.env', {}), {});
  });
  it('the real environment wins over the file, and empty variables do not', () => {
    assert.deepEqual(loadSettings(file('A=file\nB=file\nC=file'), { A: 'shell', B: '', D: 'only-env' }), { A: 'shell', B: 'file', C: 'file', D: 'only-env' });
  });
  it('another read error (a directory) is reported', () => {
    assert.throws(() => loadSettings(tmpdir(), {}));
  });
});

describe('chatsOf', () => {
  it('finds the named chats, uppercases names, skips empty ids and other keys', () => {
    assert.deepEqual(chatsOf({ TELEGRAM_CHAT_ID_foxrisk: '-100', TELEGRAM_CHAT_ID_EMPTY: '', TELEGRAM_TOKEN: 'x', TELEGRAM_CHAT_ID_TEAM_2: '5' }), { FOXRISK: '-100', TEAM_2: '5' });
  });
  it('nothing configured gives nothing', () => { assert.deepEqual(chatsOf({}), {}); });
});

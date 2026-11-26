import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { captionFor, megabytes, readApk } from '../lib/apk.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'apk-'));
const make = (name, bytes) => { const p = path.join(dir, name); writeFileSync(p, bytes); return p; };
const zipLike = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('payload')]);

describe('readApk', () => {
  it('reads a zip-shaped .apk with its size and sha256', () => {
    const a = readApk(make('ok.apk', zipLike));
    assert.equal(a.filename, 'ok.apk');
    assert.equal(a.size, zipLike.length);
    assert.equal(a.sha256, createHash('sha256').update(zipLike).digest('hex'));
    assert.deepEqual(a.bytes, zipLike);
  });
  it('accepts an upper-case extension', () => { assert.equal(readApk(make('X.APK', zipLike)).filename, 'X.APK'); });
  it('says how to build it when the file is missing', () => { assert.throws(() => readApk(path.join(dir, 'nope.apk')), /file not found.*mobile:apk/); });
  it('refuses a directory', () => { assert.throws(() => readApk(dir), /not a file/); });
  it('refuses other extensions, even with the right content', () => { assert.throws(() => readApk(make('a.zip', zipLike)), /not an \.apk/); });
  it('refuses an empty file', () => { assert.throws(() => readApk(make('empty.apk', Buffer.alloc(0))), /empty file/); });
  it('refuses a file that is not a zip', () => { assert.throws(() => readApk(make('text.apk', 'hello world')), /not a valid APK/); });
});

describe('captionFor', () => {
  const apk = { size: 5 * 1048576, sha256: 'ab'.repeat(32) };
  it('has what it is, commit, size and checksum', () => {
    const c = captionFor(apk, { commit: 'b2a294f', branch: 'feat/x' });
    assert.match(c, /Everfox: Android test build \(debug, not for the Play Store\)/);
    assert.match(c, /commit: b2a294f \(feat\/x\)/);
    assert.match(c, /size: 5\.0 MB/);
    assert.ok(c.includes(`sha256: ${apk.sha256}`));
  });
  it('leaves the commit out when it is unknown', () => { assert.doesNotMatch(captionFor(apk), /commit:/); });
  it('adds the note after a blank line', () => { assert.match(captionFor(apk, { extra: 'try Back' }), /\n\ntry Back$/); });
  it('never exceeds the 1024 characters Telegram allows', () => { assert.equal(captionFor(apk, { extra: 'x'.repeat(3000) }).length, 1024); });
});

it('megabytes rounds to one decimal', () => { assert.equal(megabytes(1572864), '1.5 MB'); });

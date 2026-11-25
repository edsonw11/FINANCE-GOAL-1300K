/**
 * lib/apk.mjs
 * Responsibility: reads an APK from disk, checks it is one, and writes the caption that goes with it.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // an APK is a zip

/** Reads the file; throws a plain Error when it is not there, is empty, is not an .apk, or is not a zip. */
export function readApk(file) {
  let st;
  try { st = statSync(file); } catch { throw new Error(`file not found: ${file} (build it with: npm run mobile:apk)`); }
  if (!st.isFile()) throw new Error(`not a file: ${file}`);
  if (path.extname(file).toLowerCase() !== '.apk') throw new Error(`not an .apk file: ${file}`);
  const bytes = readFileSync(file);
  if (bytes.length === 0) throw new Error(`empty file: ${file}`);
  if (!ZIP_MAGIC.every((b, i) => bytes[i] === b)) throw new Error(`${file} is not a valid APK (a zip archive was expected)`);
  return { bytes, filename: path.basename(file), size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export const megabytes = (n) => `${(n / 1048576).toFixed(1)} MB`;

/** The caption: what it is, which commit, how big, and the checksum to compare after installing. `extra` is a note from the sender. */
export function captionFor(apk, { name = 'Everfox', commit, branch, extra } = {}) {
  const lines = [`${name}: Android test build (debug, not for the Play Store)`];
  if (commit) lines.push(`commit: ${commit}${branch ? ` (${branch})` : ''}`);
  lines.push(`size: ${megabytes(apk.size)}`, `sha256: ${apk.sha256}`);
  if (extra) lines.push('', extra);
  return lines.join('\n').slice(0, 1024); // Telegram's caption limit
}

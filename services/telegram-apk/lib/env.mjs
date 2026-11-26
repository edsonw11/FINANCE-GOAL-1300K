/**
 * lib/env.mjs
 * Responsibility: reads KEY=VALUE settings from a .env file (no dependency) and merges them under the real environment.
 */
import { readFileSync } from 'node:fs';

/** Parses the text of a .env file: comments (#), blank lines and one pair of quotes around a value are understood. */
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))) value = value.slice(1, -1);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) out[key] = value;
  }
  return out;
}

/** The settings: the file first, then the real environment on top (so a variable set in the shell wins). A missing file is fine. */
export function loadSettings(envPath, environment = process.env) {
  let fromFile = {};
  try { fromFile = parseEnv(readFileSync(envPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const merged = { ...fromFile };
  for (const [k, v] of Object.entries(environment)) if (v !== undefined && v !== '') merged[k] = v;
  return merged;
}

/** The chat ids defined in the settings: { FOXRISK: '-100…' }. */
export function chatsOf(settings) {
  const chats = {};
  for (const [k, v] of Object.entries(settings)) { const m = /^TELEGRAM_CHAT_ID_([A-Za-z0-9_]+)$/.exec(k); if (m && v) chats[m[1].toUpperCase()] = v; }
  return chats;
}

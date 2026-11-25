#!/usr/bin/env node
/**
 * scripts/dev-export.mjs
 * Responsibility: prints (as JSON) what the API has stored for a development person, signing in like a browser. Used by scripts/dev-check.sh.
 * Usage: node scripts/dev-export.mjs alice|bob
 */
import { API, PEOPLE, signIn } from './lib/dev-session.mjs';

const user = process.argv[2];
if (!(user in PEOPLE)) { console.error(`unknown development user: ${user}`); process.exit(2); }
const jar = await signIn(user, PEOPLE[user]);
const res = await jar.fetch(`${API}/api/v1/export/legacy-state`);
if (res.status !== 200) { console.error(`export failed: ${res.status}`); process.exit(1); }
process.stdout.write(await res.text());

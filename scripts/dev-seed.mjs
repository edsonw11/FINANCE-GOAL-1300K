#!/usr/bin/env node
/**
 * scripts/dev-seed.mjs
 * Responsibility: puts the demo data (the same 12 months the app's "Dados de teste" button makes) into the local stack for the development people,
 * through the real front door: it signs in with Keycloak like a browser and calls the import endpoint. Safe to repeat (it replaces what the person has).
 * Usage: node scripts/dev-seed.mjs [alice|bob ...]      env: API_URL (default http://localhost:3000)
 */

import { API, PEOPLE, signIn } from './lib/dev-session.mjs';
const domain = (file) => import(new URL(`../src/domain/${file}`, import.meta.url).href);

/** The demo state the app itself would build, as plain data. */
async function demoState() {
  const store = await domain('store.js');
  const demo = await domain('demo-data.js');
  store.replaceState(store.blankState());
  demo.addDemoData();
  return JSON.parse(JSON.stringify(store.S));
}

/** alice gets the whole demo; bob a different, smaller one, so that a check can tell whose data is whose. */
const stateFor = (user, state) => (user === 'bob' ? { ...state, goal: 500000, tx: state.tx.slice(-60) } : state);

async function seed(user, state) {
  const jar = await signIn(user, PEOPLE[user]);
  const res = await jar.fetch(`${API}/api/v1/import/legacy-state?replace=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: API, 'x-everfox-csrf': '1' },
    body: JSON.stringify(stateFor(user, state)),
  });
  if (res.status !== 200) throw new Error(`import for ${user} failed: ${res.status} ${await res.text()}`);
  console.log(`seeded ${user}: ${JSON.stringify(await res.json())}`);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['alice'];
const unknown = names.filter((n) => !(n in PEOPLE));
if (unknown.length) { console.error(`unknown development user: ${unknown.join(', ')} (known: ${Object.keys(PEOPLE).join(', ')})`); process.exit(2); }
const state = await demoState();
for (const n of names) await seed(n, state);

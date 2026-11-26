#!/usr/bin/env node
/**
 * scripts/write-import-samples.mjs
 * Responsibility: writes the made-up import samples of tests/fixtures/import-samples.js (CSV and OFX) to a folder, to pick them by hand in the app.
 * Usage: node scripts/write-import-samples.mjs [folder]   (default /tmp/everfox-import-samples)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.resolve(process.argv[2] ?? '/tmp/everfox-import-samples');
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(path.join(root, 'tests/fixtures/import-samples.js'), 'utf8'), sandbox);
const files = { 'sample-statement.csv': sandbox.window.IMPORT_SAMPLES.csv, 'sample-bank.ofx': sandbox.window.IMPORT_SAMPLES.ofxBank, 'sample-card.ofx': sandbox.window.IMPORT_SAMPLES.ofxCard };
mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(files)) { writeFileSync(path.join(dir, name), text); console.log(path.join(dir, name)); }

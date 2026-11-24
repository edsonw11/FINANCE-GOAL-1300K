// Runs a command with backend/.env loaded when that file exists (local development).
// Variables already set in the environment win over the file, so CI and containers are not affected.
// Usage: node scripts/with-env.mjs <command> [args...]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-env.mjs <command> [args...]');
  process.exit(2);
}

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) {
  const already = { ...process.env };
  process.loadEnvFile(envFile);
  Object.assign(process.env, already);
}

const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
if (result.error) {
  console.error(`could not run "${command}": ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

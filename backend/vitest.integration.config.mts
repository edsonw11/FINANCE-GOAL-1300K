import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests: a real PostgreSQL with the migrations applied (docker compose up -d db, npm run db:migrate).
// One file at a time, because they share the database.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    unstubEnvs: true,
  },
});

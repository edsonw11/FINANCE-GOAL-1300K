import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Unit tests: no database, no network. SWC emits the decorator metadata that NestJS injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    // starting a Nest app in memory takes a few seconds on a loaded machine: the default 10 s hook limit made files fail at random (found by shuffling the file order)
    hookTimeout: 30_000,
    restoreMocks: true,
    unstubEnvs: true,
  },
});

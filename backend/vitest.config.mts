import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Unit tests: no database, no network. SWC emits the decorator metadata that NestJS injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    unstubEnvs: true,
  },
});

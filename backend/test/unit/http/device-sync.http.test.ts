import { randomUUID } from 'node:crypto';
import { afterAll } from 'vitest';
import { deviceSyncContract } from '../../contracts/device-sync.contract';
import { type TestApp, createTestApp } from '../../support/http-app';

// Real browser sync code against the whole HTTP application with in-memory storage.
let t: TestApp | null = null;
afterAll(async () => t?.close());
deviceSyncContract('in memory', async () => {
  t ??= await createTestApp();
  const app = t;
  return {
    app: app.app,
    async login(subject: string) {
      app.provider.identity = { issuer: 'http://idp.test/device', subject, email: `${subject}@example.test`, displayName: subject };
      void randomUUID;
      return app.login();
    },
  };
});

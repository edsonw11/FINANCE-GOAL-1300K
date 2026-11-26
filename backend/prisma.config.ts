import { defineConfig } from 'prisma/config';

// Prisma 7 does not read .env by itself: the scripts load it (node --env-file) or the environment provides it.
// An empty URL makes `prisma migrate` fail with a clear message; `prisma generate` does not need a database.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // migrations run as the database owner (MIGRATE_DATABASE_URL); the API itself connects with DATABASE_URL, a role that can only read and write data
  datasource: { url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL ?? '' },
});

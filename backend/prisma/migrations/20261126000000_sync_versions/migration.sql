-- Sync (ADR-0008): a per-person change counter, a version on every synced row, and a log of the mutations already applied.

-- The counter: one row per person. Writers lock it, so versions of one person are handed out and committed in order
-- and a reader that has seen version N can never miss one that commits later with a lower number.
CREATE TABLE "sync_cursor" (
    "user_id" UUID NOT NULL,
    "last_version" BIGINT NOT NULL,
    CONSTRAINT "sync_cursor_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "sync_cursor_not_negative" CHECK ("last_version" >= 0)
);

-- Every mutation a device sent, with the answer it got, so a retry gets the same answer and changes nothing.
CREATE TABLE "sync_mutation" (
    "user_id" UUID NOT NULL,
    "mutation_id" UUID NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_mutation_pkey" PRIMARY KEY ("user_id", "mutation_id")
);

ALTER TABLE "account" ADD COLUMN "version" BIGINT NOT NULL DEFAULT 0;

-- rows that already exist get a version in the order they were last changed
WITH numbered AS (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY updated_at, id) AS n FROM "account")
UPDATE "account" a SET "version" = numbered.n FROM numbered WHERE a.id = numbered.id;
INSERT INTO "sync_cursor" ("user_id", "last_version") SELECT "user_id", max("version") FROM "account" GROUP BY "user_id";

ALTER TABLE "account" ALTER COLUMN "version" DROP DEFAULT;
ALTER TABLE "account" ADD CONSTRAINT "account_version_positive" CHECK ("version" > 0);
CREATE INDEX "account_user_id_version_idx" ON "account"("user_id", "version");
CREATE INDEX "sync_mutation_created_at_idx" ON "sync_mutation"("created_at");

ALTER TABLE "sync_cursor" ADD CONSTRAINT "sync_cursor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_mutation" ADD CONSTRAINT "sync_mutation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

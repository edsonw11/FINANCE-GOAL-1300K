-- The person's finance data (Phase 4b, ADR-0011). Every list of the app (accounts, transactions, balances, trades, transfers,
-- imports) is a kind of "record": one row each, owned by a person, versioned for sync, deleted as a tombstone. The body keeps the
-- shape the browser app already uses, so nothing is lost and the shared rules run on it unchanged.

CREATE TABLE "record" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    -- the id the browser app gave it ('nu', 12, 't7'), as text, when it came from there
    "legacy_key" TEXT,
    -- the version at creation: keeps the order of the list as the person made it
    "position" BIGINT NOT NULL,
    "body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "version" BIGINT NOT NULL,
    CONSTRAINT "record_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "record_kind_format" CHECK ("kind" ~ '^[a-z][a-z0-9_]{0,30}$'),
    CONSTRAINT "record_version_positive" CHECK ("version" > 0 AND "position" > 0),
    CONSTRAINT "record_body_is_object" CHECK (jsonb_typeof("body") = 'object'),
    CONSTRAINT "record_body_size" CHECK (octet_length("body"::text) <= 32768)
);

-- the person's settings, categories and groups: one document, one version
CREATE TABLE "user_state" (
    "user_id" UUID NOT NULL,
    "body" JSONB NOT NULL,
    "version" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_state_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_state_version_positive" CHECK ("version" > 0),
    CONSTRAINT "user_state_body_is_object" CHECK (jsonb_typeof("body") = 'object'),
    CONSTRAINT "user_state_body_size" CHECK (octet_length("body"::text) <= 262144)
);

-- the accounts of Phase 3 become records of kind "account" (same ids, same versions)
INSERT INTO "record" ("id", "user_id", "kind", "legacy_key", "position", "body", "created_at", "updated_at", "deleted_at", "version")
SELECT "id", "user_id", 'account', NULL, "version", jsonb_build_object('name', "name"), "created_at", "updated_at", "deleted_at", "version" FROM "account";
DROP TABLE "account";

CREATE INDEX "record_user_id_version_idx" ON "record"("user_id", "version");
CREATE INDEX "record_user_id_kind_position_idx" ON "record"("user_id", "kind", "position");
CREATE UNIQUE INDEX "record_user_id_kind_legacy_key_key" ON "record"("user_id", "kind", "legacy_key") WHERE "legacy_key" IS NOT NULL;

ALTER TABLE "record" ADD CONSTRAINT "record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_state" ADD CONSTRAINT "user_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Plans and locked features (ADR-0010). The catalogue of feature keys lives in code; which plan has which key lives here,
-- so it can change without a deploy. Everyone starts on "free".

CREATE TABLE "plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "plan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plan_id_format" CHECK ("id" ~ '^[a-z][a-z0-9_-]{0,30}$'),
    CONSTRAINT "plan_name_length" CHECK (char_length("name") BETWEEN 1 AND 60)
);

CREATE TABLE "plan_feature" (
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    CONSTRAINT "plan_feature_pkey" PRIMARY KEY ("plan_id", "feature_key"),
    CONSTRAINT "plan_feature_key_format" CHECK ("feature_key" ~ '^[a-z][a-z0-9_.-]{0,59}$')
);

-- Starting point, to be decided by the product owner: everything that is gated is part of Pro, nothing gated is in Free.
INSERT INTO "plan" ("id", "name") VALUES ('free', 'Free'), ('pro', 'Pro');
INSERT INTO "plan_feature" ("plan_id", "feature_key")
SELECT 'pro', k FROM unnest(ARRAY['budgets.advanced', 'import.bank-files', 'investments.projection', 'report.monthly']) AS k;

ALTER TABLE "app_user" ADD COLUMN "plan_id" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "app_user" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- Who changed what, for the changes made through the admin routes.
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_user_plan_id_idx" ON "app_user"("plan_id");
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

ALTER TABLE "plan_feature" ADD CONSTRAINT "plan_feature_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- the history stays when the person who made a change is deleted
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

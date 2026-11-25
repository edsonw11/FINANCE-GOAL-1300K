-- Identity, sessions, login flows and the first owned table.
-- app_user (Phase 2) has no code that inserts rows, so there is nothing to convert. If rows exist, the NOT NULL
-- columns below make this migration fail on purpose: it never invents an identity for a row.

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "oidc_issuer" TEXT NOT NULL,
ADD COLUMN     "oidc_subject" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "session" (
    "id_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id_hash")
);

-- CreateTable
CREATE TABLE "auth_flow" (
    "id_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "code_verifier" TEXT NOT NULL,
    "return_to" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_flow_pkey" PRIMARY KEY ("id_hash")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- CreateIndex
CREATE INDEX "auth_flow_expires_at_idx" ON "auth_flow"("expires_at");

-- CreateIndex
CREATE INDEX "account_user_id_deleted_at_idx" ON "account"("user_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_oidc_issuer_oidc_subject_key" ON "app_user"("oidc_issuer", "oidc_subject");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Second barrier: the API validates these values, the database refuses the wrong ones too.
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_identity_not_empty" CHECK (char_length("oidc_issuer") > 0 AND char_length("oidc_subject") > 0);
ALTER TABLE "session" ADD CONSTRAINT "session_expires_after_creation" CHECK ("expires_at" > "created_at");
ALTER TABLE "account" ADD CONSTRAINT "account_name_length" CHECK (char_length("name") BETWEEN 1 AND 80);

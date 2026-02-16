-- Better Auth Migration
-- This script migrates from Lucia Auth to Better Auth

-- 1. Add new columns to user table for Better Auth compatibility
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "image" text;

-- 2. Migrate existing data
UPDATE "user" SET "name" = COALESCE("username", "email") WHERE "name" IS NULL;
UPDATE "user" SET "image" = "avatar_url" WHERE "image" IS NULL;

-- 3. Add new session columns for Better Auth
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "token" text;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;

-- Generate unique tokens for existing sessions (if any)
UPDATE "session" SET "token" = gen_random_uuid()::text WHERE "token" IS NULL;

-- Add unique constraint to token
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_token_unique') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_token_unique" UNIQUE ("token");
    END IF;
END $$;

-- 4. Create the account table (Better Auth format)
CREATE TABLE IF NOT EXISTS "account" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "account_id" text NOT NULL,
    "provider_id" text NOT NULL,
    "access_token" text,
    "refresh_token" text,
    "access_token_expires_at" timestamp with time zone,
    "refresh_token_expires_at" timestamp with time zone,
    "scope" text,
    "id_token" text,
    "password" text,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create index on account user_id
CREATE INDEX IF NOT EXISTS "idx_account_user_id" ON "account" ("user_id");

-- 5. Migrate data from oauth_account to account
INSERT INTO "account" ("id", "user_id", "account_id", "provider_id", "created_at", "updated_at")
SELECT 
    gen_random_uuid()::text,
    "user_id",
    "provider_user_id",
    "provider_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "oauth_account"
ON CONFLICT DO NOTHING;

-- 6. Create verification table (for email verification, password reset, etc.)
CREATE TABLE IF NOT EXISTS "verification" (
    "id" text PRIMARY KEY NOT NULL,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Create index on verification identifier
CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification" ("identifier");

-- 7. Clean up old tables (optional - keep oauth_account as backup for now)
-- DROP TABLE IF EXISTS "oauth_account";

-- Note: After verifying the migration works, you can uncomment the DROP TABLE line
-- and also remove these columns from user table if desired:
-- ALTER TABLE "user" DROP COLUMN IF EXISTS "username";
-- ALTER TABLE "user" DROP COLUMN IF EXISTS "avatar_url";
-- ALTER TABLE "user" DROP COLUMN IF EXISTS "hashed_password";

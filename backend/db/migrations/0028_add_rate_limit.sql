-- Migration: Better Auth rate-limit storage in Postgres
-- Description:
--   Better Auth's rate limiter kept its counters in memory, which on Vercel is
--   per serverless instance, so limits like "3 password-reset requests per
--   minute" could be exceeded by spreading requests across instances. Storing
--   the counters here makes every instance share them.
--   key = "<client ip>|<auth path>", last_request = epoch milliseconds.

CREATE TABLE IF NOT EXISTS "rate_limit" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,
    CONSTRAINT "rate_limit_key_unique" UNIQUE ("key")
);

-- Better Auth prunes expired rows with DELETE ... WHERE last_request < cutoff
CREATE INDEX IF NOT EXISTS "idx_rate_limit_last_request" ON "rate_limit" USING btree ("last_request");

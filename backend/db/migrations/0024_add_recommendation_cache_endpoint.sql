-- Adds an `endpoint` column to recommendation_cache so background cleanup can
-- apply tiered retention: the shared `for_you_pool` row is kept indefinitely
-- (it is the fast path for returning users and is bounded at one active row
-- per user), while paged endpoints (`genre`, `theatrical`) are swept 15 days
-- after expiry.
ALTER TABLE "recommendation_cache"
    ADD COLUMN IF NOT EXISTS "endpoint" text NOT NULL DEFAULT 'unknown';

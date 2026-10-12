-- Migration: Taste profile on by default
-- Description: The AI taste profile is now on unless a user turns it off. Existing
--   users are switched on too: when this shipped nobody had turned it on yet, so
--   no one had made a choice to keep it off.

ALTER TABLE "user" ALTER COLUMN "taste_profile_enabled" SET DEFAULT true;

UPDATE "user" SET "taste_profile_enabled" = true WHERE "taste_profile_enabled" = false;

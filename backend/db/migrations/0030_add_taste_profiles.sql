-- Migration: AI taste profiles on the stats page
-- Description:
--   user.taste_profile_enabled: opt-in. Comments are only sent to the AI provider
--   (Groq) once the user turns this on; turning it off deletes stored profiles.
--   user_taste_profiles caches one generated summary per user and period
--   ('all' or a year). `fingerprint` captures the comments it was written from,
--   so it is regenerated only when those comments change.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "taste_profile_enabled" BOOLEAN DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "user_taste_profiles" (
    "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "comment_count" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY ("user_id", "period")
);

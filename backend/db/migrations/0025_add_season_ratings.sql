-- Migration: Add per-season ratings for TV shows
-- Description:
--   media_ratings gains a nullable season_number column:
--     NULL      -> show-level (overall) rating. All pre-existing rows are show-level
--                  ratings and stay untouched (NULL) so no user data is lost.
--     0         -> TMDB "Specials" season
--     1 .. N    -> numbered seasons
--   The old show-level unique constraint is replaced with two partial unique
--   indexes so a user can rate the show overall AND each season independently.
--   Show-level mbuff score = average of rated season scores; while a show has no
--   season ratings yet, its legacy overall ratings continue to drive the score.

ALTER TABLE "media_ratings" ADD COLUMN IF NOT EXISTS "season_number" INTEGER;

-- season_number must be a valid TMDB season (0 = specials) or NULL for show-level
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_ratings_season_number_check') THEN
        ALTER TABLE "media_ratings" ADD CONSTRAINT "media_ratings_season_number_check"
            CHECK ("season_number" IS NULL OR ("season_number" >= 0 AND "season_number" <= 500));
    END IF;
END $$;

-- Replace (user_id, media_type, tmdb_id) unique constraint with partial unique
-- indexes: one overall rating + one rating per season per user per media.
ALTER TABLE "media_ratings" DROP CONSTRAINT IF EXISTS "media_ratings_user_media_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "media_ratings_user_media_overall_unique"
    ON "media_ratings" ("user_id", "media_type", "tmdb_id")
    WHERE "season_number" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "media_ratings_user_media_season_unique"
    ON "media_ratings" ("user_id", "media_type", "tmdb_id", "season_number")
    WHERE "season_number" IS NOT NULL;

-- Supports per-season aggregate queries
CREATE INDEX IF NOT EXISTS "idx_media_ratings_media_season"
    ON "media_ratings" USING btree ("media_type", "tmdb_id", "season_number");

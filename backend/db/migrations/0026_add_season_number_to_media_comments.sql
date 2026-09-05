-- Migration: Add season_number to media_comments
-- Description:
--   Follow-up to 0025_add_season_ratings.sql: comments are season-scoped for TV
--   shows, mirroring media_ratings.
--     NULL      -> show-level (overall) comment. All pre-existing rows stay NULL.
--     0         -> TMDB "Specials" season
--     1 .. N    -> numbered seasons

ALTER TABLE "media_comments" ADD COLUMN IF NOT EXISTS "season_number" INTEGER;

-- season_number must be a valid TMDB season (0 = specials) or NULL for show-level
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_comments_season_number_check') THEN
        ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_season_number_check"
            CHECK ("season_number" IS NULL OR ("season_number" >= 0 AND "season_number" <= 500));
    END IF;
END $$;

-- Supports season-scoped comment listing
CREATE INDEX IF NOT EXISTS "idx_media_comments_media_season"
    ON "media_comments" USING btree ("media_type", "tmdb_id", "season_number");

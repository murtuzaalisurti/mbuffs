-- Migration: Add media metadata cache
-- Description: Caches the TMDB fields that viewing stats need (runtime, genres,
--   directors/creators, top-billed cast, release year, language, countries,
--   TMDB vote count/average and popularity) so
--   the stats endpoint does not hit TMDB for every watched title on every load.
--   Rows are shared across users: one row per (media_type, tmdb_id).

CREATE TABLE IF NOT EXISTS "media_metadata" (
    "media_type" TEXT NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "title" TEXT,
    "poster_path" TEXT,
    "release_year" INTEGER,
    "runtime_minutes" INTEGER,
    "genres" JSONB DEFAULT '[]'::jsonb NOT NULL,
    "directors" JSONB DEFAULT '[]'::jsonb NOT NULL,
    "top_cast" JSONB DEFAULT '[]'::jsonb NOT NULL,
    "original_language" TEXT,
    "origin_countries" JSONB DEFAULT '[]'::jsonb NOT NULL,
    -- TMDB audience signals; vote_count is the "how widely seen" proxy for niche stats
    "vote_count" INTEGER,
    "vote_average" NUMERIC(3,1),
    "popularity" NUMERIC(10,3),
    "fetched_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY ("media_type", "tmdb_id")
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_metadata_media_type_check') THEN
        ALTER TABLE "media_metadata" ADD CONSTRAINT "media_metadata_media_type_check"
            CHECK ("media_type" IN ('movie', 'tv'));
    END IF;
END $$;

-- Databases that ran an early version of this migration (as 0027_add_media_metadata.sql)
-- have the table without the TMDB vote columns; CREATE TABLE IF NOT EXISTS skips them.
ALTER TABLE "media_metadata" ADD COLUMN IF NOT EXISTS "vote_count" INTEGER;
ALTER TABLE "media_metadata" ADD COLUMN IF NOT EXISTS "vote_average" NUMERIC(3,1);
ALTER TABLE "media_metadata" ADD COLUMN IF NOT EXISTS "popularity" NUMERIC(10,3);

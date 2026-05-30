-- Migration: Add OMDB ratings table
-- Description: Stores IMDB and Rotten Tomatoes ratings fetched from the OMDB API

CREATE TABLE IF NOT EXISTS "omdb_ratings" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "tmdb_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "imdb_id" TEXT,
    "title" TEXT,
    "year" TEXT,
    "imdb_rating" NUMERIC(3,1),
    "imdb_votes" TEXT,
    "rotten_tomatoes_rating" INTEGER,
    "metacritic_rating" INTEGER,
    "scraped_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_omdb_ratings_tmdb_id" ON "omdb_ratings" USING btree ("tmdb_id");
CREATE INDEX IF NOT EXISTS "idx_omdb_ratings_imdb_id" ON "omdb_ratings" USING btree ("imdb_id");

-- Unique constraint: one entry per (tmdb_id, media_type)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'omdb_ratings_tmdb_id_media_type_key') THEN
        ALTER TABLE "omdb_ratings" ADD CONSTRAINT "omdb_ratings_tmdb_id_media_type_key" UNIQUE ("tmdb_id", "media_type");
    END IF;
END $$;

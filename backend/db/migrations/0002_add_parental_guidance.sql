-- Migration: Add parental guidance and scrape metadata tables
-- Description: Tables for storing IMDB parental guidance data and tracking scrape metadata

-- Create parental_guidance table
CREATE TABLE IF NOT EXISTS "parental_guidance" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "imdb_id" TEXT NOT NULL,
    "tmdb_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "nudity" TEXT,
    "violence" TEXT,
    "profanity" TEXT,
    "alcohol" TEXT,
    "frightening" TEXT,
    "nudity_description" TEXT,
    "violence_description" TEXT,
    "profanity_description" TEXT,
    "alcohol_description" TEXT,
    "frightening_description" TEXT,
    "scraped_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for parental_guidance
CREATE INDEX IF NOT EXISTS "idx_parental_guidance_imdb_id" ON "parental_guidance" USING btree ("imdb_id");
CREATE INDEX IF NOT EXISTS "idx_parental_guidance_tmdb_id" ON "parental_guidance" USING btree ("tmdb_id");

-- Create unique constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parental_guidance_imdb_id_key') THEN
        ALTER TABLE "parental_guidance" ADD CONSTRAINT "parental_guidance_imdb_id_key" UNIQUE ("imdb_id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parental_guidance_tmdb_id_media_type_key') THEN
        ALTER TABLE "parental_guidance" ADD CONSTRAINT "parental_guidance_tmdb_id_media_type_key" UNIQUE ("tmdb_id", "media_type");
    END IF;
END $$;

-- Create scrape_metadata table
CREATE TABLE IF NOT EXISTS "scrape_metadata" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "scrape_type" TEXT NOT NULL,
    "last_scraped_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "items_scraped" TEXT
);

-- Create unique constraint for scrape_metadata
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scrape_metadata_type_key') THEN
        ALTER TABLE "scrape_metadata" ADD CONSTRAINT "scrape_metadata_type_key" UNIQUE ("scrape_type");
    END IF;
END $$;

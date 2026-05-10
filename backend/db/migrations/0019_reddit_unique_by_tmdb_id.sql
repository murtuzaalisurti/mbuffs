-- Fix reddit_recommendations disambiguation: unique on tmdb_id instead of title,
-- and add release_year so same-name movies from different years are stored separately.

ALTER TABLE reddit_recommendations
    ADD COLUMN IF NOT EXISTS release_year INTEGER;

-- Drop the title-based unique index
DROP INDEX IF EXISTS reddit_recommendations_title_key;

-- Remove duplicate tmdb_id rows, keeping the one with the highest mention_count * total_score
-- (ties broken by keeping the row with the smallest id, i.e. earliest inserted)
DELETE FROM reddit_recommendations
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY tmdb_id
                   ORDER BY (mention_count * total_score) DESC, id ASC
               ) AS rn
        FROM reddit_recommendations
        WHERE tmdb_id IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Unique on tmdb_id (partial: only for non-null rows, so rows without a match don't block each other)
CREATE UNIQUE INDEX IF NOT EXISTS reddit_recommendations_tmdb_id_key
    ON reddit_recommendations (tmdb_id)
    WHERE tmdb_id IS NOT NULL;

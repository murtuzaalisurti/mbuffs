CREATE TABLE homepage_collage_items (
    id TEXT PRIMARY KEY NOT NULL,
    tmdb_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    poster_path TEXT,
    added_by_user_id TEXT NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT homepage_collage_items_added_by_user_id_fkey
        FOREIGN KEY (added_by_user_id) REFERENCES "user"(id) ON DELETE SET NULL,
    CONSTRAINT homepage_collage_items_media_type_check
        CHECK (media_type IN ('movie', 'tv'))
);

CREATE INDEX idx_homepage_collage_items_tmdb_id ON homepage_collage_items (tmdb_id);
CREATE UNIQUE INDEX homepage_collage_items_tmdb_id_media_type_key ON homepage_collage_items (tmdb_id, media_type);

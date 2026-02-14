-- Migration: Add support for multiple recommendation source collections
-- This creates a junction table to allow users to select multiple collections as recommendation sources

-- ============================================================================
-- CREATE USER_RECOMMENDATION_COLLECTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "user_recommendation_collections" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "collection_id" text NOT NULL,
    "added_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

-- Ensure a user can only add a collection once as a recommendation source
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_recommendation_collections_user_collection_key') THEN
        ALTER TABLE "user_recommendation_collections" ADD CONSTRAINT "user_recommendation_collections_user_collection_key" 
            UNIQUE("user_id", "collection_id");
    END IF;
END $$;

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_recommendation_collections_user_id_fkey') THEN
        ALTER TABLE "user_recommendation_collections" ADD CONSTRAINT "user_recommendation_collections_user_id_fkey" 
            FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_recommendation_collections_collection_id_fkey') THEN
        ALTER TABLE "user_recommendation_collections" ADD CONSTRAINT "user_recommendation_collections_collection_id_fkey" 
            FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_user_recommendation_collections_user_id" ON "user_recommendation_collections" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_recommendation_collections_collection_id" ON "user_recommendation_collections" USING btree ("collection_id");

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================

-- If users have a single recommendations_collection_id set, migrate it to the new table
-- Generate UUIDs using gen_random_uuid() which is available in PostgreSQL 13+
INSERT INTO "user_recommendation_collections" ("id", "user_id", "collection_id", "added_at")
SELECT 
    gen_random_uuid()::text,
    u.id,
    u.recommendations_collection_id,
    NOW()
FROM "user" u
WHERE u.recommendations_collection_id IS NOT NULL
ON CONFLICT ("user_id", "collection_id") DO NOTHING;

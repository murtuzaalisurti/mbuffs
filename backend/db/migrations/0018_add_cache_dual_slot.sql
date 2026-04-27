-- Add dual-slot support for recommendation cache regeneration

ALTER TABLE "recommendation_cache"
    ADD COLUMN IF NOT EXISTS "slot" text DEFAULT 'active' NOT NULL;

ALTER TABLE "recommendation_cache"
    ADD COLUMN IF NOT EXISTS "generation_started_at" timestamp with time zone;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendation_cache_user_cache_key') THEN
        ALTER TABLE "recommendation_cache"
            DROP CONSTRAINT "recommendation_cache_user_cache_key";
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendation_cache_user_cache_key') THEN
        ALTER TABLE "recommendation_cache"
            ADD CONSTRAINT "recommendation_cache_user_cache_key" UNIQUE ("user_id", "cache_key", "slot");
    END IF;
END $$;

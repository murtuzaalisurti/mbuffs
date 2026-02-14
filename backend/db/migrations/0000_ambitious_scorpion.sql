-- Current sql file was generated after introspecting the database
-- Made idempotent with IF NOT EXISTS and DO $$ blocks

-- ============================================================================
-- SEQUENCES
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS "public"."_migrations_id_seq" 
    INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;

-- ============================================================================
-- TABLES
-- ============================================================================

-- User table (must be created first due to foreign key dependencies)
CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY NOT NULL,
    "username" text,
    "email" text,
    "hashed_password" text,
    "avatar_url" text,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "recommendations_enabled" boolean DEFAULT false,
    "recommendations_collection_id" text
);

-- Session table
CREATE TABLE IF NOT EXISTS "session" (
    "id" text PRIMARY KEY NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "user_id" text NOT NULL
);

-- OAuth account table
CREATE TABLE IF NOT EXISTS "oauth_account" (
    "provider_id" text NOT NULL,
    "provider_user_id" text NOT NULL,
    "user_id" text NOT NULL,
    CONSTRAINT "oauth_account_pkey" PRIMARY KEY("provider_id","provider_user_id")
);

-- Collections table
CREATE TABLE IF NOT EXISTS "collections" (
    "id" text PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "description" text,
    "owner_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "shareable_id" text
);

-- Collection collaborators table
CREATE TABLE IF NOT EXISTS "collection_collaborators" (
    "id" text PRIMARY KEY NOT NULL,
    "collection_id" text NOT NULL,
    "user_id" text NOT NULL,
    "permission" text DEFAULT 'view' NOT NULL,
    "added_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Collection movies table
CREATE TABLE IF NOT EXISTS "collection_movies" (
    "id" text PRIMARY KEY NOT NULL,
    "collection_id" text NOT NULL,
    "movie_id" varchar NOT NULL,
    "added_by_user_id" text NOT NULL,
    "added_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "is_movie" boolean
);

-- ============================================================================
-- UNIQUE CONSTRAINTS (idempotent)
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_username_key') THEN
        ALTER TABLE "user" ADD CONSTRAINT "user_username_key" UNIQUE("username");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_email_key') THEN
        ALTER TABLE "user" ADD CONSTRAINT "user_email_key" UNIQUE("email");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collections_shareable_id_key') THEN
        ALTER TABLE "collections" ADD CONSTRAINT "collections_shareable_id_key" UNIQUE("shareable_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_collaborators_collection_id_user_id_key') THEN
        ALTER TABLE "collection_collaborators" ADD CONSTRAINT "collection_collaborators_collection_id_user_id_key" UNIQUE("collection_id","user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_movies_collection_id_movie_id_key') THEN
        ALTER TABLE "collection_movies" ADD CONSTRAINT "collection_movies_collection_id_movie_id_key" UNIQUE("collection_id","movie_id");
    END IF;
END $$;

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS (idempotent)
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collections_owner_id_fkey') THEN
        ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_fkey" 
            FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_collaborators_collection_id_fkey') THEN
        ALTER TABLE "collection_collaborators" ADD CONSTRAINT "collection_collaborators_collection_id_fkey" 
            FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_collaborators_user_id_fkey') THEN
        ALTER TABLE "collection_collaborators" ADD CONSTRAINT "collection_collaborators_user_id_fkey" 
            FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_movies_added_by_user_id_fkey') THEN
        ALTER TABLE "collection_movies" ADD CONSTRAINT "collection_movies_added_by_user_id_fkey" 
            FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_movies_collection_id_fkey') THEN
        ALTER TABLE "collection_movies" ADD CONSTRAINT "collection_movies_collection_id_fkey" 
            FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_fkey') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" 
            FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_recommendations_collection_id_fkey') THEN
        ALTER TABLE "user" ADD CONSTRAINT "user_recommendations_collection_id_fkey" 
            FOREIGN KEY ("recommendations_collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_account_user_id_fkey') THEN
        ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_user_id_fkey" 
            FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- ============================================================================
-- INDEXES (idempotent)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "collections_owner_id_idx" ON "collections" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_collections_owner_id" ON "collections" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "collection_collaborators_collection_id_idx" ON "collection_collaborators" USING btree ("collection_id");
CREATE INDEX IF NOT EXISTS "collection_collaborators_user_id_idx" ON "collection_collaborators" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_collection_collaborators_collection_id" ON "collection_collaborators" USING btree ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_collection_collaborators_user_id" ON "collection_collaborators" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "collection_movies_collection_id_idx" ON "collection_movies" USING btree ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_collection_movies_collection_id" ON "collection_movies" USING btree ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_collection_movies_movie_id" ON "collection_movies" USING btree ("movie_id");
CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user" USING btree ("email");

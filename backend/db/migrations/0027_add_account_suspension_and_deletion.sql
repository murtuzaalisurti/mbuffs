-- Migration: Account suspension and deletion
-- Description:
--   1. Admins can suspend an account. A suspended user can't sign in and their
--      existing sessions are revoked. Unsuspending restores access.
--   2. Accounts can be deleted (by the user themselves or by an admin). The
--      user row is hard-deleted and dependent data cascades.
--
--   These "added by" columns were declared NOT NULL while their foreign keys are
--   ON DELETE SET NULL, so deleting any user who had ever added an item would
--   fail with a not-null violation. Drop NOT NULL so the item survives with an
--   unknown author (e.g. a title a former collaborator added to a shared
--   collection stays in that collection).

ALTER TABLE "collection_movies" ALTER COLUMN "added_by_user_id" DROP NOT NULL;
ALTER TABLE "admin_curated_items" ALTER COLUMN "added_by_user_id" DROP NOT NULL;
ALTER TABLE "homepage_collage_items" ALTER COLUMN "added_by_user_id" DROP NOT NULL;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspended_by_user_id" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_suspended_by_user_id_fkey') THEN
        ALTER TABLE "user" ADD CONSTRAINT "user_suspended_by_user_id_fkey"
            FOREIGN KEY ("suspended_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
    END IF;
END $$;

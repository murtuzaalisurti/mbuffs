-- Add category_recommendations_enabled column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "category_recommendations_enabled" boolean DEFAULT true;

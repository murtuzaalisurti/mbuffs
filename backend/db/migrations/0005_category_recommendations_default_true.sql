-- Update category_recommendations_enabled default to true and set existing rows to true
ALTER TABLE "user" ALTER COLUMN "category_recommendations_enabled" SET DEFAULT true;

-- Update existing users to have category_recommendations_enabled = true
UPDATE "user" SET "category_recommendations_enabled" = true WHERE "category_recommendations_enabled" IS NULL OR "category_recommendations_enabled" = false;

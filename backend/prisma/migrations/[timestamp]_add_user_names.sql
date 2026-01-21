-- First, create temporary columns
ALTER TABLE "User" ADD COLUMN "temp_id" INT;
ALTER TABLE "User" ADD COLUMN "temp_role" TEXT;
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Copy existing data
UPDATE "User" SET 
  "temp_id" = CAST("id" AS INT),
  "temp_role" = "role",
  "firstName" = SPLIT_PART("name", ' ', 1),
  "lastName" = SPLIT_PART("name", ' ', 2);

-- Drop old columns
ALTER TABLE "User" DROP COLUMN "id";
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" DROP COLUMN "name";

-- Recreate columns with new types
ALTER TABLE "User" ADD COLUMN "id" INT PRIMARY KEY;
ALTER TABLE "User" ADD COLUMN "role" TEXT DEFAULT 'user';

-- Restore data
UPDATE "User" SET 
  "id" = "temp_id",
  "role" = "temp_role";

-- Clean up temporary columns
ALTER TABLE "User" DROP COLUMN "temp_id";
ALTER TABLE "User" DROP COLUMN "temp_role";

-- Set NOT NULL constraints
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;
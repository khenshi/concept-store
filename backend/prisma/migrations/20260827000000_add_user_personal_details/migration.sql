ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "phone" TEXT;

UPDATE "User"
SET "firstName" = 'Account', "lastName" = 'User'
WHERE "firstName" IS NULL OR "lastName" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

BEGIN;

ALTER TABLE "SpaceType"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD CONSTRAINT "SpaceType_version_check" CHECK ("version" > 0);

CREATE INDEX "SpaceType_organizationId_archivedAt_name_idx"
  ON "SpaceType"("organizationId", "archivedAt", "name");

DROP TRIGGER IF EXISTS "Space_register_type" ON "Space";
DROP FUNCTION IF EXISTS register_space_type();

COMMIT;

CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Branch"
ADD COLUMN "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Branch_organizationId_status_idx"
ON "Branch"("organizationId", "status");

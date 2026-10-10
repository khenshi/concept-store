-- CreateEnum
CREATE TYPE "SpaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SpaceReleaseReason" AS ENUM ('MANUAL', 'PARTICIPATION_INACTIVE', 'MERCHANT_INACTIVE', 'MERCHANT_SUSPENDED', 'MERCHANT_ENDED');

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "SpaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceOccupancy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,
    "releasedById" TEXT,
    "releaseReason" "SpaceReleaseReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpaceOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Space_organizationId_branchId_status_name_idx" ON "Space"("organizationId", "branchId", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Space_id_organizationId_branchId_key" ON "Space"("id", "organizationId", "branchId");

-- CreateIndex
CREATE INDEX "SpaceOccupancy_organizationId_branchId_spaceId_startedAt_id_idx" ON "SpaceOccupancy"("organizationId", "branchId", "spaceId", "startedAt", "id");

-- CreateIndex
CREATE INDEX "SpaceOccupancy_organizationId_merchantId_endedAt_startedAt__idx" ON "SpaceOccupancy"("organizationId", "merchantId", "endedAt", "startedAt", "id");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceOccupancy" ADD CONSTRAINT "SpaceOccupancy_spaceId_organizationId_branchId_fkey" FOREIGN KEY ("spaceId", "organizationId", "branchId") REFERENCES "Space"("id", "organizationId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceOccupancy" ADD CONSTRAINT "SpaceOccupancy_organizationId_branchId_merchantId_fkey" FOREIGN KEY ("organizationId", "branchId", "merchantId") REFERENCES "MerchantBranch"("organizationId", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceOccupancy" ADD CONSTRAINT "SpaceOccupancy_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceOccupancy" ADD CONSTRAINT "SpaceOccupancy_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Space_branch_name_key" ON "Space" ("organizationId", "branchId", lower("name"));
CREATE UNIQUE INDEX "SpaceOccupancy_open_space_key" ON "SpaceOccupancy" ("organizationId", "branchId", "spaceId") WHERE "endedAt" IS NULL;
ALTER TABLE "Space" ADD CONSTRAINT "Space_labels_check" CHECK (length(btrim("name")) BETWEEN 1 AND 120 AND length(btrim("type")) BETWEEN 1 AND 80);
ALTER TABLE "SpaceOccupancy" ADD CONSTRAINT "SpaceOccupancy_interval_check" CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt");
ALTER TABLE "SpaceOccupancy" ADD CONSTRAINT "SpaceOccupancy_release_check" CHECK (("endedAt" IS NULL AND "releasedById" IS NULL AND "releaseReason" IS NULL) OR ("endedAt" IS NOT NULL AND "releasedById" IS NOT NULL AND "releaseReason" IS NOT NULL));

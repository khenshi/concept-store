-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('RACK', 'SHELF', 'CABINET', 'BOOTH', 'TABLE', 'DRAWER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SpaceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Support the tenant-safe SpaceAssignment reference to MerchantBranch.
CREATE UNIQUE INDEX "MerchantBranch_merchantId_branchId_organizationId_key"
ON "MerchantBranch"("merchantId", "branchId", "organizationId");

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpaceType" NOT NULL,
    "customType" TEXT,
    "status" "SpaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Space_customType_check" CHECK (
        ("type" = 'CUSTOM' AND "customType" IS NOT NULL AND length(btrim("customType")) > 0)
        OR ("type" <> 'CUSTOM' AND "customType" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "SpaceAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpaceAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SpaceAssignment_date_order_check" CHECK (
        "endDate" IS NULL OR "endDate" >= "startDate"
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Space_organizationId_branchId_code_key" ON "Space"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Space_id_branchId_organizationId_key" ON "Space"("id", "branchId", "organizationId");

-- CreateIndex
CREATE INDEX "Space_organizationId_branchId_status_idx" ON "Space"("organizationId", "branchId", "status");

-- CreateIndex
CREATE INDEX "Space_organizationId_branchId_name_idx" ON "Space"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "SpaceAssignment_organizationId_branchId_idx" ON "SpaceAssignment"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "SpaceAssignment_organizationId_merchantId_idx" ON "SpaceAssignment"("organizationId", "merchantId");

-- CreateIndex
CREATE INDEX "SpaceAssignment_spaceId_startDate_idx" ON "SpaceAssignment"("spaceId", "startDate");

-- A space can have at most one assignment without an end date.
CREATE UNIQUE INDEX "SpaceAssignment_one_current_per_space_key"
ON "SpaceAssignment"("spaceId")
WHERE "endDate" IS NULL;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceAssignment" ADD CONSTRAINT "SpaceAssignment_spaceId_branchId_organizationId_fkey" FOREIGN KEY ("spaceId", "branchId", "organizationId") REFERENCES "Space"("id", "branchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceAssignment" ADD CONSTRAINT "SpaceAssignment_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceAssignment" ADD CONSTRAINT "SpaceAssignment_merchantId_branchId_organizationId_fkey" FOREIGN KEY ("merchantId", "branchId", "organizationId") REFERENCES "MerchantBranch"("merchantId", "branchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

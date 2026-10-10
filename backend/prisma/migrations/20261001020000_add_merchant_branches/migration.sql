-- Deploy with application writes paused; the old application must not run afterward.
BEGIN;
CREATE TYPE "MerchantBranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TABLE "MerchantBranch" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "MerchantBranchStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantBranch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantBranch_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MerchantBranch_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MerchantBranch_organizationId_branchId_merchantId_key" ON "MerchantBranch"("organizationId", "branchId", "merchantId");
CREATE INDEX "MerchantBranch_organizationId_merchantId_status_branchId_idx" ON "MerchantBranch"("organizationId", "merchantId", "status", "branchId");
CREATE INDEX "MerchantBranch_organizationId_branchId_status_merchantId_idx" ON "MerchantBranch"("organizationId", "branchId", "status", "merchantId");
ALTER TABLE "BranchInventory" ADD COLUMN "merchantId" TEXT;
DO $$
DECLARE placements BIGINT; grants BIGINT; associations BIGINT; converted BIGINT; revoked BIGINT; backfilled BIGINT;
BEGIN
  SELECT count(*) INTO placements FROM "BranchInventory";
  INSERT INTO "MerchantBranch" ("organizationId", "branchId", "merchantId")
    SELECT DISTINCT i."organizationId", i."branchId", p."merchantId"
    FROM "BranchInventory" i JOIN "Product" p ON p."id" = i."productId" AND p."organizationId" = i."organizationId";
  SELECT count(*) INTO grants FROM "BranchMembership" b JOIN "OrganizationMembership" m USING ("organizationId", "userId") WHERE m."role" = 'MERCHANT';
  SELECT count(*) INTO converted FROM "BranchMembership" b JOIN "OrganizationMembership" m USING ("organizationId", "userId") WHERE m."role" = 'MERCHANT' AND m."merchantId" IS NOT NULL;
  INSERT INTO "MerchantBranch" ("organizationId", "branchId", "merchantId")
    SELECT DISTINCT b."organizationId", b."branchId", m."merchantId"
    FROM "BranchMembership" b JOIN "OrganizationMembership" m USING ("organizationId", "userId")
    WHERE m."role" = 'MERCHANT' AND m."merchantId" IS NOT NULL
    ON CONFLICT ("organizationId", "branchId", "merchantId") DO NOTHING;
  SELECT count(*) INTO associations FROM "MerchantBranch";
  UPDATE "BranchInventory" i SET "merchantId" = p."merchantId" FROM "Product" p WHERE p."id" = i."productId" AND p."organizationId" = i."organizationId";
  GET DIAGNOSTICS backfilled = ROW_COUNT;
  IF backfilled <> placements THEN RAISE EXCEPTION 'Inventory ownership backfill incomplete'; END IF;
  DELETE FROM "BranchMembership" b USING "OrganizationMembership" m WHERE b."organizationId" = m."organizationId" AND b."userId" = m."userId" AND m."role" = 'MERCHANT';
  UPDATE "OrganizationInvitation" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "role" = 'MERCHANT' AND "acceptedAt" IS NULL AND "revokedAt" IS NULL;
  GET DIAGNOSTICS revoked = ROW_COUNT;
  RAISE NOTICE 'Merchant branches: % associations created, % linked grants converted, % merchant grants removed, % invitations revoked, % inventory rows backfilled', associations, converted, grants, revoked, backfilled;
END $$;
ALTER TABLE "BranchInventory" ALTER COLUMN "merchantId" SET NOT NULL;
ALTER TABLE "BranchInventory" DROP CONSTRAINT "BranchInventory_productId_organizationId_fkey";
ALTER TABLE "BranchInventory" ADD CONSTRAINT "BranchInventory_productId_organizationId_merchantId_fkey" FOREIGN KEY ("productId", "organizationId", "merchantId") REFERENCES "Product"("id", "organizationId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchInventory" ADD CONSTRAINT "BranchInventory_organizationId_branchId_merchantId_fkey" FOREIGN KEY ("organizationId", "branchId", "merchantId") REFERENCES "MerchantBranch"("organizationId", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantBranch" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "MerchantBranch" ALTER COLUMN "updatedAt" DROP DEFAULT;
COMMIT;

-- Historical space assignments must survive removal of current branch participation.
-- The API still requires MerchantBranch participation when creating an assignment
-- and prevents participation removal while a current assignment exists.
ALTER TABLE "SpaceAssignment"
DROP CONSTRAINT "SpaceAssignment_merchantId_branchId_organizationId_fkey";

DROP INDEX "MerchantBranch_merchantId_branchId_organizationId_key";

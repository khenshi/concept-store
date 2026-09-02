DROP INDEX IF EXISTS "MerchantSettlement_organizationId_generationKey_key";

ALTER TABLE "MerchantSettlement"
  DROP COLUMN "generationType",
  DROP COLUMN "generationKey",
  DROP COLUMN "generationReason",
  DROP COLUMN "rentAccruedAmount";

ALTER TABLE "SettlementTermSnapshot"
  DROP COLUMN "rentCollectionMethod",
  DROP COLUMN "rentDeductionTiming",
  DROP COLUMN "fixedRentAmount",
  DROP COLUMN "rentAccruedAmount";

DROP TYPE "SettlementGenerationType";
DROP TYPE "RentCollectionMethod";
DROP TYPE "RentDeductionTiming";

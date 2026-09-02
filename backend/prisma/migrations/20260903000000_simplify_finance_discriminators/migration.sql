DROP INDEX "MerchantReceivable_organizationId_merchantId_type_sourcePeriod_key";

ALTER TABLE "SettlementAdjustment" DROP COLUMN "type";
ALTER TABLE "MerchantReceivable" DROP COLUMN "type";

CREATE UNIQUE INDEX "MerchantReceivable_organizationId_merchantId_sourcePeriod_key"
ON "MerchantReceivable"("organizationId", "merchantId", "sourcePeriod");

DROP TYPE "MerchantAccountEntryType";
DROP TYPE "MerchantReceivableType";

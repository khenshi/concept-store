-- Settlements remain immutable historical closures. Their scheduled deadline is
-- snapshotted separately from the actual early/regular closure date.
ALTER TABLE "MerchantSettlement"
  ADD COLUMN "scheduledDeadline" DATE,
  ADD COLUMN "rentAccruedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "MerchantSettlement"
SET "scheduledDeadline" = "periodEnd"
WHERE "scheduledDeadline" IS NULL;

-- A later refund of an already-paid sale can legitimately make a new live
-- period's net sales negative. Commission floors at zero for that segment.
ALTER TABLE "MerchantSettlement"
  DROP CONSTRAINT "MerchantSettlement_refund_totals_check";

ALTER TABLE "MerchantSettlement"
  ADD CONSTRAINT "MerchantSettlement_refund_totals_check"
  CHECK ("refundTotal" >= 0 AND "netSales" = "grossSales" - "refundTotal");

-- An adjustment may accrue before a settlement exists. It is attached to the
-- settlement inside the same serializable transaction that closes the balance.
ALTER TABLE "SettlementAdjustment"
  DROP CONSTRAINT "SettlementAdjustment_settlementId_merchantId_organizationI_fkey";

DROP INDEX "SettlementAdjustment_id_settlementId_organizationId_key";

ALTER TABLE "SettlementAdjustment"
  ALTER COLUMN "settlementId" DROP NOT NULL;

CREATE TYPE "MerchantAccountEntryType" AS ENUM ('ADJUSTMENT', 'MERCHANT_PAYMENT');
CREATE TYPE "RentCollectionMethod" AS ENUM ('DEDUCT_FROM_PAYOUT', 'PAID_SEPARATELY');
CREATE TYPE "RentDeductionTiming" AS ENUM ('FIRST_SETTLEMENT_OF_MONTH', 'LAST_SETTLEMENT_OF_MONTH', 'PRORATED_PER_SETTLEMENT');

ALTER TABLE "SettlementAdjustment"
  ADD COLUMN "type" "MerchantAccountEntryType" NOT NULL DEFAULT 'ADJUSTMENT',
  ADD COLUMN "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "MerchantAgreement"
  ADD COLUMN "rentCollectionMethod" "RentCollectionMethod" NOT NULL DEFAULT 'DEDUCT_FROM_PAYOUT',
  ADD COLUMN "rentDeductionTiming" "RentDeductionTiming" NOT NULL DEFAULT 'FIRST_SETTLEMENT_OF_MONTH';

ALTER TABLE "SettlementTermSnapshot"
  ADD COLUMN "rentCollectionMethod" "RentCollectionMethod" NOT NULL DEFAULT 'DEDUCT_FROM_PAYOUT',
  ADD COLUMN "rentDeductionTiming" "RentDeductionTiming" NOT NULL DEFAULT 'FIRST_SETTLEMENT_OF_MONTH',
  ADD COLUMN "rentAccruedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "SettlementAdjustment_id_organizationId_key"
  ON "SettlementAdjustment"("id", "organizationId");

ALTER TABLE "SettlementAdjustment"
  ADD CONSTRAINT "SettlementAdjustment_settlementId_merchantId_organizationI_fkey"
  FOREIGN KEY ("settlementId", "merchantId", "organizationId")
  REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only one closure may be awaiting approval or payout for a merchant.
CREATE UNIQUE INDEX "MerchantSettlement_one_open_per_merchant_key"
  ON "MerchantSettlement"("organizationId", "merchantId")
  WHERE "status" IN ('DRAFT', 'REVIEWED', 'APPROVED');

ALTER TABLE "MerchantSettlement"
  DROP CONSTRAINT "MerchantSettlement_lifecycle_check";

ALTER TABLE "MerchantSettlement"
  ADD CONSTRAINT "MerchantSettlement_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "approvedById" IS NULL AND "approvedAt" IS NULL)
    OR ("status" = 'REVIEWED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL)
    OR ("status" IN ('APPROVED', 'PAID') AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
  );

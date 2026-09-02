-- Repair databases where the live-payables migration was recorded before its
-- final schema changes were added. Defaults preserve all historical rows.
CREATE TYPE "RentCollectionMethod" AS ENUM (
  'DEDUCT_FROM_PAYOUT',
  'PAID_SEPARATELY'
);

CREATE TYPE "RentDeductionTiming" AS ENUM (
  'FIRST_SETTLEMENT_OF_MONTH',
  'LAST_SETTLEMENT_OF_MONTH',
  'PRORATED_PER_SETTLEMENT'
);

CREATE TYPE "MerchantAccountEntryType" AS ENUM (
  'ADJUSTMENT',
  'MERCHANT_PAYMENT'
);

ALTER TABLE "MerchantAgreement"
  ADD COLUMN "rentCollectionMethod" "RentCollectionMethod" NOT NULL
    DEFAULT 'DEDUCT_FROM_PAYOUT',
  ADD COLUMN "rentDeductionTiming" "RentDeductionTiming" NOT NULL
    DEFAULT 'FIRST_SETTLEMENT_OF_MONTH';

ALTER TABLE "MerchantSettlement"
  ADD COLUMN "rentAccruedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "SettlementAdjustment"
  ADD COLUMN "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "type" "MerchantAccountEntryType" NOT NULL DEFAULT 'ADJUSTMENT';

ALTER TABLE "SettlementTermSnapshot"
  ADD COLUMN "rentAccruedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "rentCollectionMethod" "RentCollectionMethod" NOT NULL
    DEFAULT 'DEDUCT_FROM_PAYOUT',
  ADD COLUMN "rentDeductionTiming" "RentDeductionTiming" NOT NULL
    DEFAULT 'FIRST_SETTLEMENT_OF_MONTH';

CREATE UNIQUE INDEX "MerchantSettlement_one_open_per_merchant_key"
  ON "MerchantSettlement"("organizationId", "merchantId")
  WHERE "status" IN ('DRAFT', 'REVIEWED', 'APPROVED');

ALTER TABLE "MerchantSettlement"
  DROP CONSTRAINT "MerchantSettlement_lifecycle_check";

ALTER TABLE "MerchantSettlement"
  ADD CONSTRAINT "MerchantSettlement_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "approvedById" IS NULL AND "approvedAt" IS NULL)
    OR (
      "status" = 'REVIEWED'
      AND "reviewedById" IS NOT NULL
      AND "reviewedAt" IS NOT NULL
      AND "approvedById" IS NULL
      AND "approvedAt" IS NULL
    )
    OR (
      "status" IN ('APPROVED', 'PAID')
      AND "approvedById" IS NOT NULL
      AND "approvedAt" IS NOT NULL
    )
  );

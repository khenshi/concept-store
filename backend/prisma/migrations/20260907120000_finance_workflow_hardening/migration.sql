ALTER TABLE "MerchantAgreement"
  ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduledEndDate" DATE,
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endedById" TEXT,
  ADD COLUMN IF NOT EXISTS "endReason" TEXT;

ALTER TABLE "MerchantAgreement"
  DROP CONSTRAINT IF EXISTS "MerchantAgreement_durationMonths_check";
ALTER TABLE "MerchantAgreement"
  ADD CONSTRAINT "MerchantAgreement_durationMonths_check"
  CHECK ("durationMonths" IS NULL OR ("durationMonths" BETWEEN 1 AND 60));
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantAgreement_active_merchant_key"
  ON "MerchantAgreement"("organizationId", "merchantId")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "MerchantSettlement"
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledById" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "closureRequestId" TEXT;

ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "SettlementAuditEventType" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "MerchantSettlement"
  DROP CONSTRAINT IF EXISTS "MerchantSettlement_lifecycle_check";

DROP INDEX IF EXISTS "MerchantSettlement_one_open_per_merchant_key";

-- The development workflow no longer has a separate reviewed state. Existing
-- rows remain auditable through their reviewedAt/reviewedById fields and audit
-- events, but return to the actionable draft state during migration.
UPDATE "MerchantSettlement"
SET "status" = 'DRAFT'
WHERE "status" = 'REVIEWED';

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSettlement_one_open_per_merchant_key"
  ON "MerchantSettlement"("organizationId", "merchantId")
  WHERE "status" IN ('DRAFT', 'APPROVED');

ALTER TABLE "MerchantSettlement"
  ADD CONSTRAINT "MerchantSettlement_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "approvedById" IS NULL AND "approvedAt" IS NULL)
    OR ("status" IN ('APPROVED', 'PAID') AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
    OR ("status" = 'CANCELLED' AND "approvedById" IS NULL AND "approvedAt" IS NULL)
  );

ALTER TABLE "SettlementSaleItem"
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);
DROP INDEX IF EXISTS "SettlementSaleItem_saleItemId_key";

ALTER TABLE "SettlementRefundItem"
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);
DROP INDEX IF EXISTS "SettlementRefundItem_refundItemId_key";

ALTER TABLE "SettlementReceivableAllocation"
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);

-- MerchantFinanceEntry is the Prisma model name; the physical PostgreSQL
-- table is mapped to SettlementAdjustment via @@map in schema.prisma.
ALTER TABLE "SettlementAdjustment"
  ADD COLUMN IF NOT EXISTS "releasedFromSettlementId" TEXT,
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidedById" TEXT,
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

ALTER TABLE "MerchantReceivable"
  ADD COLUMN IF NOT EXISTS "periodStart" DATE,
  ADD COLUMN IF NOT EXISTS "periodEnd" DATE,
  ADD COLUMN IF NOT EXISTS "cycleNumber" INTEGER;

UPDATE "MerchantReceivable"
SET "periodStart" = "sourcePeriod",
    "periodEnd" = "sourcePeriod"
WHERE "periodStart" IS NULL;

DROP INDEX IF EXISTS "MerchantReceivable_organizationId_merchantId_sourcePeriod_key";

ALTER TABLE "MerchantReceivableTransaction"
  ADD COLUMN IF NOT EXISTS "requestId" TEXT;

CREATE INDEX IF NOT EXISTS "SettlementSaleItem_organizationId_merchantId_saleItemId_idx"
  ON "SettlementSaleItem"("organizationId", "merchantId", "saleItemId");
CREATE INDEX IF NOT EXISTS "SettlementRefundItem_organizationId_merchantId_refundItemId_idx"
  ON "SettlementRefundItem"("organizationId", "merchantId", "refundItemId");
CREATE INDEX IF NOT EXISTS "SettlementSaleItem_active_source_idx"
  ON "SettlementSaleItem"("organizationId", "merchantId", "releasedAt");
CREATE INDEX IF NOT EXISTS "SettlementRefundItem_active_source_idx"
  ON "SettlementRefundItem"("organizationId", "merchantId", "releasedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SettlementSaleItem_active_source_key"
  ON "SettlementSaleItem"("organizationId", "merchantId", "saleItemId")
  WHERE "releasedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SettlementRefundItem_active_source_key"
  ON "SettlementRefundItem"("organizationId", "merchantId", "refundItemId")
  WHERE "releasedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "SettlementReceivableAllocation_active_idx"
  ON "SettlementReceivableAllocation"("organizationId", "merchantId", "receivableId", "releasedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SettlementReceivableAllocation_active_key"
  ON "SettlementReceivableAllocation"("organizationId", "merchantId", "receivableId")
  WHERE "appliedAt" IS NULL AND "releasedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "MerchantReceivable_cycle_idx"
  ON "MerchantReceivable"("organizationId", "agreementId", "cycleNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantReceivable_organizationId_agreementId_cycleNumber_key"
  ON "MerchantReceivable"("organizationId", "agreementId", "cycleNumber");
CREATE INDEX IF NOT EXISTS "MerchantFinanceEntry_organizationId_merchantId_voidedAt_idx"
  ON "SettlementAdjustment"("organizationId", "merchantId", "voidedAt");
CREATE INDEX IF NOT EXISTS "MerchantFinanceEntry_releasedFromSettlement_idx"
  ON "SettlementAdjustment"("releasedFromSettlementId", "merchantId", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantReceivableTransaction_request_key"
  ON "MerchantReceivableTransaction"("organizationId", "requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSettlement_closure_request_key"
  ON "MerchantSettlement"("organizationId", "closureRequestId");

ALTER TABLE "SettlementAdjustment"
  DROP CONSTRAINT IF EXISTS "SettlementAdjustment_releasedFromSettlement_fkey";
ALTER TABLE "SettlementAdjustment"
  ADD CONSTRAINT "SettlementAdjustment_releasedFromSettlement_fkey"
  FOREIGN KEY ("releasedFromSettlementId", "merchantId", "organizationId")
  REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "RefundStatus" AS ENUM ('COMPLETED');
CREATE TYPE "SettlementGenerationType" AS ENUM ('SCHEDULED', 'OFF_CYCLE');
CREATE TYPE "SettlementAuditEventType" AS ENUM ('AUTO_GENERATED', 'MANUALLY_GENERATED', 'OFF_CYCLE_GENERATED', 'RECALCULATED', 'ADJUSTMENT_ADDED', 'ADJUSTMENT_UPDATED', 'ADJUSTMENT_REMOVED', 'REVIEWED', 'RETURNED_TO_DRAFT', 'APPROVED', 'PAYOUT_RECORDED');

ALTER TABLE "MerchantSettlement"
  ADD COLUMN "generationType" "SettlementGenerationType" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "generationKey" TEXT,
  ADD COLUMN "generationReason" TEXT,
  ADD COLUMN "refundTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "netSales" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "MerchantSettlement" SET "netSales" = "grossSales";
ALTER TABLE "MerchantSettlement" DROP CONSTRAINT "MerchantSettlement_total_check";
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_refund_totals_check" CHECK ("refundTotal" >= 0 AND "refundTotal" <= "grossSales" AND "netSales" = "grossSales" - "refundTotal");
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_total_check" CHECK ("netPayout" = "netSales" - "commissionAmount" - "fixedRentAmount" + "adjustmentTotal");
ALTER TABLE "MerchantSettlement" DROP CONSTRAINT "MerchantSettlement_no_overlapping_periods_excl";
CREATE UNIQUE INDEX "MerchantSettlement_organizationId_generationKey_key" ON "MerchantSettlement"("organizationId", "generationKey");

ALTER TABLE "SettlementTermSnapshot"
  ADD COLUMN "refundTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "netSales" DECIMAL(14,2) NOT NULL DEFAULT 0;
UPDATE "SettlementTermSnapshot" SET "netSales" = "grossSales";

CREATE TABLE "SaleRefund" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL, "reason" TEXT NOT NULL, "status" "RefundStatus" NOT NULL DEFAULT 'COMPLETED',
  "completedById" TEXT NOT NULL, "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleRefund_reason_check" CHECK (char_length("reason") BETWEEN 1 AND 500)
);
CREATE UNIQUE INDEX "SaleRefund_id_organizationId_key" ON "SaleRefund"("id", "organizationId");
CREATE INDEX "SaleRefund_organizationId_branchId_completedAt_idx" ON "SaleRefund"("organizationId", "branchId", "completedAt");

CREATE TABLE "SaleRefundItem" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "refundId" TEXT NOT NULL,
  "saleItemId" TEXT NOT NULL, "merchantId" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, CONSTRAINT "SaleRefundItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleRefundItem_values_check" CHECK ("quantity" > 0 AND "amount" > 0)
);
CREATE UNIQUE INDEX "SaleRefundItem_id_merchantId_organizationId_key" ON "SaleRefundItem"("id", "merchantId", "organizationId");

CREATE TABLE "SettlementRefundItem" (
  "settlementId" TEXT NOT NULL, "refundItemId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL, "refundAmount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementRefundItem_pkey" PRIMARY KEY ("settlementId", "refundItemId")
);
CREATE UNIQUE INDEX "SettlementRefundItem_refundItemId_key" ON "SettlementRefundItem"("refundItemId");

CREATE TABLE "SettlementAuditEvent" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "settlementId" TEXT NOT NULL,
  "actorId" TEXT, "type" "SettlementAuditEventType" NOT NULL, "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SettlementAuditEvent_organizationId_settlementId_createdAt_idx" ON "SettlementAuditEvent"("organizationId", "settlementId", "createdAt");

ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_saleId_organizationId_fkey" FOREIGN KEY ("saleId", "organizationId") REFERENCES "Sale"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRefund" ADD CONSTRAINT "SaleRefund_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRefundItem" ADD CONSTRAINT "SaleRefundItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRefundItem" ADD CONSTRAINT "SaleRefundItem_refundId_organizationId_fkey" FOREIGN KEY ("refundId", "organizationId") REFERENCES "SaleRefund"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRefundItem" ADD CONSTRAINT "SaleRefundItem_saleItemId_merchantId_organizationId_fkey" FOREIGN KEY ("saleItemId", "merchantId", "organizationId") REFERENCES "SaleItem"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleRefundItem" ADD CONSTRAINT "SaleRefundItem_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementRefundItem" ADD CONSTRAINT "SettlementRefundItem_settlementId_merchantId_organizationId_fkey" FOREIGN KEY ("settlementId", "merchantId", "organizationId") REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementRefundItem" ADD CONSTRAINT "SettlementRefundItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementRefundItem" ADD CONSTRAINT "SettlementRefundItem_refundItemId_merchantId_organizationId_fkey" FOREIGN KEY ("refundItemId", "merchantId", "organizationId") REFERENCES "SaleRefundItem"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAuditEvent" ADD CONSTRAINT "SettlementAuditEvent_settlementId_organizationId_fkey" FOREIGN KEY ("settlementId", "organizationId") REFERENCES "MerchantSettlement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAuditEvent" ADD CONSTRAINT "SettlementAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAuditEvent" ADD CONSTRAINT "SettlementAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

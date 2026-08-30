-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('CASH', 'GCASH', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "MerchantSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "schedule" "SettlementSchedule" NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "grossSales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fixedRentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustmentTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPayout" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "calculatedById" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantSettlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MerchantSettlement_date_order_check" CHECK ("periodEnd" >= "periodStart"),
    CONSTRAINT "MerchantSettlement_amounts_check" CHECK (
        "grossSales" >= 0
        AND "commissionAmount" >= 0
        AND "commissionAmount" <= "grossSales"
        AND "fixedRentAmount" >= 0
    ),
    CONSTRAINT "MerchantSettlement_total_check" CHECK (
        "netPayout" = "grossSales" - "commissionAmount" - "fixedRentAmount" + "adjustmentTotal"
    ),
    CONSTRAINT "MerchantSettlement_lifecycle_check" CHECK (
        ("status" = 'DRAFT' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL)
        OR ("status" = 'REVIEWED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL)
        OR ("status" IN ('APPROVED', 'PAID') AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "SettlementTermSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "segmentStart" DATE NOT NULL,
    "segmentEnd" DATE NOT NULL,
    "schedule" "SettlementSchedule" NOT NULL,
    "fixedRentRate" DECIMAL(12,2),
    "commissionRate" DECIMAL(5,2),
    "grossSales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fixedRentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementTermSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SettlementTermSnapshot_date_order_check" CHECK ("segmentEnd" >= "segmentStart"),
    CONSTRAINT "SettlementTermSnapshot_terms_check" CHECK (
        ("fixedRentRate" IS NULL OR "fixedRentRate" > 0)
        AND ("commissionRate" IS NULL OR ("commissionRate" > 0 AND "commissionRate" <= 100))
        AND ("fixedRentRate" IS NOT NULL OR "commissionRate" IS NOT NULL)
    ),
    CONSTRAINT "SettlementTermSnapshot_amounts_check" CHECK (
        "grossSales" >= 0
        AND "commissionAmount" >= 0
        AND "commissionAmount" <= "grossSales"
        AND "fixedRentAmount" >= 0
    )
);

-- CreateTable
CREATE TABLE "SettlementSaleItem" (
    "settlementId" TEXT NOT NULL,
    "termSnapshotId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementSaleItem_pkey" PRIMARY KEY ("settlementId", "saleItemId"),
    CONSTRAINT "SettlementSaleItem_gross_amount_check" CHECK ("grossAmount" >= 0)
);

-- CreateTable
CREATE TABLE "SettlementAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SettlementAdjustment_amount_check" CHECK ("amount" <> 0),
    CONSTRAINT "SettlementAdjustment_reason_check" CHECK (char_length("reason") BETWEEN 1 AND 500)
);

-- CreateTable
CREATE TABLE "MerchantPayout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "referenceNumber" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantPayout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MerchantPayout_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "MerchantPayout_reference_check" CHECK ("referenceNumber" IS NULL OR char_length("referenceNumber") BETWEEN 1 AND 120),
    CONSTRAINT "MerchantPayout_note_check" CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 500),
    CONSTRAINT "MerchantPayout_non_cash_reference_check" CHECK ("method" = 'CASH' OR "referenceNumber" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_id_merchantId_organizationId_key" ON "SaleItem"("id", "merchantId", "organizationId");
CREATE UNIQUE INDEX "MerchantSettlement_id_organizationId_key" ON "MerchantSettlement"("id", "organizationId");
CREATE UNIQUE INDEX "MerchantSettlement_id_merchantId_organizationId_key" ON "MerchantSettlement"("id", "merchantId", "organizationId");
CREATE UNIQUE INDEX "MerchantSettlement_organizationId_merchantId_periodStart_pe_key" ON "MerchantSettlement"("organizationId", "merchantId", "periodStart", "periodEnd");
CREATE INDEX "MerchantSettlement_organizationId_status_periodEnd_idx" ON "MerchantSettlement"("organizationId", "status", "periodEnd");
CREATE INDEX "MerchantSettlement_organizationId_merchantId_periodEnd_idx" ON "MerchantSettlement"("organizationId", "merchantId", "periodEnd");
CREATE UNIQUE INDEX "SettlementTermSnapshot_id_settlementId_merchantId_organizat_key" ON "SettlementTermSnapshot"("id", "settlementId", "merchantId", "organizationId");
CREATE UNIQUE INDEX "SettlementTermSnapshot_settlementId_agreementId_segmentStar_key" ON "SettlementTermSnapshot"("settlementId", "agreementId", "segmentStart");
CREATE INDEX "SettlementTermSnapshot_organizationId_merchantId_segmentSta_idx" ON "SettlementTermSnapshot"("organizationId", "merchantId", "segmentStart");
CREATE UNIQUE INDEX "SettlementSaleItem_saleItemId_key" ON "SettlementSaleItem"("saleItemId");
CREATE INDEX "SettlementSaleItem_organizationId_merchantId_settlementId_idx" ON "SettlementSaleItem"("organizationId", "merchantId", "settlementId");
CREATE INDEX "SettlementSaleItem_termSnapshotId_idx" ON "SettlementSaleItem"("termSnapshotId");
CREATE UNIQUE INDEX "SettlementAdjustment_id_settlementId_organizationId_key" ON "SettlementAdjustment"("id", "settlementId", "organizationId");
CREATE INDEX "SettlementAdjustment_organizationId_merchantId_settlementId_idx" ON "SettlementAdjustment"("organizationId", "merchantId", "settlementId");
CREATE INDEX "SettlementAdjustment_createdById_createdAt_idx" ON "SettlementAdjustment"("createdById", "createdAt");
CREATE UNIQUE INDEX "MerchantPayout_id_organizationId_key" ON "MerchantPayout"("id", "organizationId");
CREATE UNIQUE INDEX "MerchantPayout_settlementId_merchantId_organizationId_key" ON "MerchantPayout"("settlementId", "merchantId", "organizationId");
CREATE INDEX "MerchantPayout_organizationId_merchantId_paidAt_idx" ON "MerchantPayout"("organizationId", "merchantId", "paidAt");
CREATE INDEX "MerchantPayout_recordedById_paidAt_idx" ON "MerchantPayout"("recordedById", "paidAt");

-- Prevent overlapping settlement periods for the same tenant merchant.
ALTER TABLE "MerchantSettlement"
ADD CONSTRAINT "MerchantSettlement_no_overlapping_periods_excl"
EXCLUDE USING GIST (
    "organizationId" WITH =,
    "merchantId" WITH =,
    daterange("periodStart", "periodEnd", '[]') WITH &&
);

-- AddForeignKey
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementTermSnapshot" ADD CONSTRAINT "SettlementTermSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementTermSnapshot" ADD CONSTRAINT "SettlementTermSnapshot_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementTermSnapshot" ADD CONSTRAINT "SettlementTermSnapshot_settlementId_merchantId_organizatio_fkey" FOREIGN KEY ("settlementId", "merchantId", "organizationId") REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementTermSnapshot" ADD CONSTRAINT "SettlementTermSnapshot_agreementId_organizationId_fkey" FOREIGN KEY ("agreementId", "organizationId") REFERENCES "MerchantAgreement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaleItem" ADD CONSTRAINT "SettlementSaleItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaleItem" ADD CONSTRAINT "SettlementSaleItem_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaleItem" ADD CONSTRAINT "SettlementSaleItem_settlementId_merchantId_organizationId_fkey" FOREIGN KEY ("settlementId", "merchantId", "organizationId") REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaleItem" ADD CONSTRAINT "SettlementSaleItem_termSnapshotId_settlementId_merchantId__fkey" FOREIGN KEY ("termSnapshotId", "settlementId", "merchantId", "organizationId") REFERENCES "SettlementTermSnapshot"("id", "settlementId", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementSaleItem" ADD CONSTRAINT "SettlementSaleItem_saleItemId_merchantId_organizationId_fkey" FOREIGN KEY ("saleItemId", "merchantId", "organizationId") REFERENCES "SaleItem"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_settlementId_merchantId_organizationI_fkey" FOREIGN KEY ("settlementId", "merchantId", "organizationId") REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantPayout" ADD CONSTRAINT "MerchantPayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantPayout" ADD CONSTRAINT "MerchantPayout_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantPayout" ADD CONSTRAINT "MerchantPayout_settlementId_merchantId_organizationId_fkey" FOREIGN KEY ("settlementId", "merchantId", "organizationId") REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantPayout" ADD CONSTRAINT "MerchantPayout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

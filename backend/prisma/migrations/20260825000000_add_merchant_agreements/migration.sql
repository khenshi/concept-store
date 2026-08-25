-- CreateEnum
CREATE TYPE "SettlementSchedule" AS ENUM ('WEEKLY', 'SEMI_MONTHLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "MerchantAgreement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "fixedRentAmount" DECIMAL(12,2),
    "commissionRate" DECIMAL(5,2),
    "settlementSchedule" "SettlementSchedule" NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantAgreement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MerchantAgreement_date_order_check" CHECK (
        "endDate" IS NULL OR "endDate" >= "startDate"
    ),
    CONSTRAINT "MerchantAgreement_fixed_rent_check" CHECK (
        "fixedRentAmount" IS NULL OR "fixedRentAmount" > 0
    ),
    CONSTRAINT "MerchantAgreement_commission_rate_check" CHECK (
        "commissionRate" IS NULL
        OR ("commissionRate" > 0 AND "commissionRate" <= 100)
    ),
    CONSTRAINT "MerchantAgreement_active_terms_check" CHECK (
        "status" <> 'ACTIVE'
        OR "fixedRentAmount" IS NOT NULL
        OR "commissionRate" IS NOT NULL
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAgreement_id_organizationId_key" ON "MerchantAgreement"("id", "organizationId");

-- CreateIndex
CREATE INDEX "MerchantAgreement_organizationId_merchantId_status_idx" ON "MerchantAgreement"("organizationId", "merchantId", "status");

-- CreateIndex
CREATE INDEX "MerchantAgreement_organizationId_status_idx" ON "MerchantAgreement"("organizationId", "status");

-- A merchant can have at most one active commercial agreement.
CREATE UNIQUE INDEX "MerchantAgreement_one_active_per_merchant_key"
ON "MerchantAgreement"("merchantId")
WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "MerchantAgreement" ADD CONSTRAINT "MerchantAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAgreement" ADD CONSTRAINT "MerchantAgreement_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

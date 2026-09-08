CREATE TYPE "MerchantFinanceAccrualKind" AS ENUM (
  'EARNED_ACTIVITY',
  'POST_SETTLEMENT_REFUND'
);

CREATE TABLE "MerchantFinanceAccrual" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "schedule" "SettlementSchedule" NOT NULL,
  "kind" "MerchantFinanceAccrualKind" NOT NULL DEFAULT 'EARNED_ACTIVITY',
  "commissionRate" DECIMAL(5,2),
  "grossSales" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "refundTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MerchantFinanceAccrual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantFinanceAccrual_period_check"
    CHECK ("periodEnd" >= "periodStart"),
  CONSTRAINT "MerchantFinanceAccrual_rate_check"
    CHECK (
      "commissionRate" IS NULL
      OR ("commissionRate" > 0 AND "commissionRate" <= 100)
    ),
  CONSTRAINT "MerchantFinanceAccrual_amounts_check"
    CHECK (
      "grossSales" >= 0
      AND "refundTotal" >= 0
      AND "revision" >= 0
      AND (
        ("kind" = 'EARNED_ACTIVITY' AND "commissionAmount" >= 0)
        OR (
          "kind" = 'POST_SETTLEMENT_REFUND'
          AND "grossSales" = 0
          AND "commissionAmount" <= 0
        )
      )
    )
);

CREATE UNIQUE INDEX "MerchantFinanceAccrual_bucket_key"
  ON "MerchantFinanceAccrual"(
    "organizationId",
    "merchantId",
    "agreementId",
    "periodStart",
    "periodEnd",
    "kind"
  );

CREATE INDEX "MerchantFinanceAccrual_merchant_period_idx"
  ON "MerchantFinanceAccrual"("organizationId", "merchantId", "periodEnd");

CREATE INDEX "MerchantFinanceAccrual_organization_period_idx"
  ON "MerchantFinanceAccrual"("organizationId", "periodEnd");

ALTER TABLE "MerchantFinanceAccrual"
  ADD CONSTRAINT "MerchantFinanceAccrual_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantFinanceAccrual"
  ADD CONSTRAINT "MerchantFinanceAccrual_merchantId_organizationId_fkey"
  FOREIGN KEY ("merchantId", "organizationId")
  REFERENCES "Merchant"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantFinanceAccrual"
  ADD CONSTRAINT "MerchantFinanceAccrual_agreementId_organizationId_fkey"
  FOREIGN KEY ("agreementId", "organizationId")
  REFERENCES "MerchantAgreement"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

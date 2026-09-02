CREATE TYPE "MerchantReceivableType" AS ENUM ('RENT');
CREATE TYPE "MerchantReceivableStatus" AS ENUM (
  'OPEN',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE'
);
CREATE TYPE "MerchantReceivableTransactionType" AS ENUM (
  'PAYMENT',
  'SETTLEMENT_DEDUCTION',
  'ADJUSTMENT'
);

CREATE TABLE "MerchantReceivable" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "type" "MerchantReceivableType" NOT NULL DEFAULT 'RENT',
  "sourcePeriod" DATE NOT NULL,
  "originalAmount" DECIMAL(14,2) NOT NULL,
  "remainingAmount" DECIMAL(14,2) NOT NULL,
  "dueDate" DATE NOT NULL,
  "status" "MerchantReceivableStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantReceivable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantReceivable_amount_check" CHECK (
    "originalAmount" > 0 AND "remainingAmount" >= 0
  )
);

CREATE TABLE "MerchantReceivableTransaction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "receivableId" TEXT NOT NULL,
  "settlementId" TEXT,
  "type" "MerchantReceivableTransactionType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paymentMethod" "PaymentMethod",
  "referenceNumber" TEXT,
  "note" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantReceivableTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantReceivableTransaction_amount_check" CHECK ("amount" <> 0)
);

CREATE UNIQUE INDEX "MerchantReceivable_id_merchantId_organizationId_key"
  ON "MerchantReceivable"("id", "merchantId", "organizationId");
CREATE UNIQUE INDEX "MerchantReceivable_organizationId_merchantId_type_sourcePeriod_key"
  ON "MerchantReceivable"("organizationId", "merchantId", "type", "sourcePeriod");
CREATE INDEX "MerchantReceivable_organizationId_status_dueDate_idx"
  ON "MerchantReceivable"("organizationId", "status", "dueDate");
CREATE INDEX "MerchantReceivable_organizationId_merchantId_sourcePeriod_idx"
  ON "MerchantReceivable"("organizationId", "merchantId", "sourcePeriod");

CREATE UNIQUE INDEX "MerchantReceivableTransaction_id_organizationId_key"
  ON "MerchantReceivableTransaction"("id", "organizationId");
CREATE INDEX "MerchantReceivableTransaction_organizationId_receivableId_occurredAt_idx"
  ON "MerchantReceivableTransaction"("organizationId", "receivableId", "occurredAt");
CREATE INDEX "MerchantReceivableTransaction_organizationId_merchantId_occurredAt_idx"
  ON "MerchantReceivableTransaction"("organizationId", "merchantId", "occurredAt");
CREATE INDEX "MerchantReceivableTransaction_settlementId_idx"
  ON "MerchantReceivableTransaction"("settlementId");
CREATE INDEX "MerchantReceivableTransaction_recordedById_occurredAt_idx"
  ON "MerchantReceivableTransaction"("recordedById", "occurredAt");

ALTER TABLE "MerchantReceivable"
  ADD CONSTRAINT "MerchantReceivable_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantReceivable"
  ADD CONSTRAINT "MerchantReceivable_merchantId_organizationId_fkey"
  FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantReceivable"
  ADD CONSTRAINT "MerchantReceivable_agreementId_organizationId_fkey"
  FOREIGN KEY ("agreementId", "organizationId") REFERENCES "MerchantAgreement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantReceivableTransaction"
  ADD CONSTRAINT "MerchantReceivableTransaction_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantReceivableTransaction"
  ADD CONSTRAINT "MerchantReceivableTransaction_merchantId_organizationId_fkey"
  FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantReceivableTransaction"
  ADD CONSTRAINT "MerchantReceivableTransaction_receivableId_merchantId_organizationId_fkey"
  FOREIGN KEY ("receivableId", "merchantId", "organizationId") REFERENCES "MerchantReceivable"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantReceivableTransaction"
  ADD CONSTRAINT "MerchantReceivableTransaction_settlementId_merchantId_organizationId_fkey"
  FOREIGN KEY ("settlementId", "merchantId", "organizationId") REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantReceivableTransaction"
  ADD CONSTRAINT "MerchantReceivableTransaction_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

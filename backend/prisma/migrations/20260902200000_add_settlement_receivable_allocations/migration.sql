CREATE TABLE "SettlementReceivableAllocation" (
  "settlementId" TEXT NOT NULL,
  "receivableId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementReceivableAllocation_pkey" PRIMARY KEY ("settlementId", "receivableId"),
  CONSTRAINT "SettlementReceivableAllocation_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "SettlementReceivableAllocation_organizationId_merchantId_settlementId_idx"
  ON "SettlementReceivableAllocation"("organizationId", "merchantId", "settlementId");
CREATE INDEX "SettlementReceivableAllocation_organizationId_receivableId_appliedAt_idx"
  ON "SettlementReceivableAllocation"("organizationId", "receivableId", "appliedAt");

ALTER TABLE "SettlementReceivableAllocation"
  ADD CONSTRAINT "SettlementReceivableAllocation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReceivableAllocation"
  ADD CONSTRAINT "SettlementReceivableAllocation_merchantId_organizationId_fkey"
  FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReceivableAllocation"
  ADD CONSTRAINT "SettlementReceivableAllocation_settlementId_merchantId_organizationId_fkey"
  FOREIGN KEY ("settlementId", "merchantId", "organizationId") REFERENCES "MerchantSettlement"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReceivableAllocation"
  ADD CONSTRAINT "SettlementReceivableAllocation_receivableId_merchantId_organizationId_fkey"
  FOREIGN KEY ("receivableId", "merchantId", "organizationId") REFERENCES "MerchantReceivable"("id", "merchantId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantPayout" DROP CONSTRAINT "MerchantPayout_amount_check";
ALTER TABLE "MerchantPayout"
  ADD CONSTRAINT "MerchantPayout_amount_check" CHECK ("amount" >= 0);

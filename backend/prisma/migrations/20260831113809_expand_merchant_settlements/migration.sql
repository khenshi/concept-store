-- CreateIndex
CREATE INDEX "SaleRefund_saleId_completedAt_idx" ON "SaleRefund"("saleId", "completedAt");

-- CreateIndex
CREATE INDEX "SaleRefundItem_organizationId_merchantId_refundId_idx" ON "SaleRefundItem"("organizationId", "merchantId", "refundId");

-- CreateIndex
CREATE INDEX "SaleRefundItem_saleItemId_idx" ON "SaleRefundItem"("saleItemId");

-- CreateIndex
CREATE INDEX "SettlementRefundItem_organizationId_merchantId_settlementId_idx" ON "SettlementRefundItem"("organizationId", "merchantId", "settlementId");

-- RenameForeignKey
ALTER TABLE "SettlementRefundItem" RENAME CONSTRAINT "SettlementRefundItem_refundItemId_merchantId_organizationId_fke" TO "SettlementRefundItem_refundItemId_merchantId_organizationI_fkey";

-- RenameForeignKey
ALTER TABLE "SettlementRefundItem" RENAME CONSTRAINT "SettlementRefundItem_settlementId_merchantId_organizationId_fke" TO "SettlementRefundItem_settlementId_merchantId_organizationI_fkey";

-- AddForeignKey
ALTER TABLE "SettlementRefundItem" ADD CONSTRAINT "SettlementRefundItem_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

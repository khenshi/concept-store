CREATE INDEX "Sale_organizationId_completedAt_idx"
ON "Sale"("organizationId", "completedAt");

CREATE INDEX "SaleRefund_organizationId_completedAt_idx"
ON "SaleRefund"("organizationId", "completedAt");

CREATE INDEX "MerchantPayout_organizationId_paidAt_idx"
ON "MerchantPayout"("organizationId", "paidAt");

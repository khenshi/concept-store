-- CreateIndex
CREATE UNIQUE INDEX "Branch_id_organizationId_key" ON "Branch"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_id_organizationId_key" ON "Merchant"("id", "organizationId");

-- CreateTable
CREATE TABLE "MerchantBranch" (
    "organizationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantBranch_pkey" PRIMARY KEY ("merchantId", "branchId")
);

-- CreateIndex
CREATE INDEX "MerchantBranch_organizationId_branchId_idx" ON "MerchantBranch"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "MerchantBranch_organizationId_merchantId_idx" ON "MerchantBranch"("organizationId", "merchantId");

-- AddForeignKey
ALTER TABLE "MerchantBranch" ADD CONSTRAINT "MerchantBranch_merchantId_organizationId_fkey" FOREIGN KEY ("merchantId", "organizationId") REFERENCES "Merchant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantBranch" ADD CONSTRAINT "MerchantBranch_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
